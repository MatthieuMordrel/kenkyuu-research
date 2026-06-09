"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { buildResearchEmailHtml } from "../shared/buildResearchEmailHtml";
import { formatDuration } from "../shared/formatDuration";
import { sanitizeForTelegramMarkdown } from "../shared/sanitizeForTelegramMarkdown";

/**
 * Dispatches notifications to all enabled channels after a research job
 * completes or fails. Called from the webhook handler or job completion flow.
 */
export const dispatchJobNotification = internalAction({
  args: {
    jobId: vv.id("researchJobs"),
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(
      internal.research.queries.getJobInternal.getJobInternal,
      {
        id: args.jobId,
      }
    );
    if (!job) return;

    // Only notify for completed or failed jobs
    if (job.status !== "completed" && job.status !== "failed") return;

    // Check enabled channels
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "notification_telegram_enabled" }
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "notification_email_enabled" }
    );

    // Resolve stock names for the message
    const stocks = await Promise.all(
      job.stockIds.map((id) =>
        ctx.runQuery(
          internal.research.queries.getStockInternal.getStockInternal,
          {
            id,
          }
        )
      )
    );
    const stockTickers = stocks
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => s.ticker);

    const stockLabel =
      stockTickers.length > 0 ? stockTickers.join(", ") : "Discovery research";

    // Build notification content
    const isCompleted = job.status === "completed";
    const statusEmoji = isCompleted ? "\u2705" : "\u274c";
    const statusText = isCompleted ? "completed" : "failed";

    // Link to the research detail page (shared by email + telegram;
    // app_url is auto-synced by the frontend).
    const appUrl: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "app_url" }
    );
    const viewUrl = appUrl
      ? `${appUrl.replace(/\/+$/, "")}/research/${args.jobId}`
      : undefined;

    // --- Telegram ---
    if (telegramEnabled === "true") {
      const lines: string[] = [
        `${statusEmoji} *Research ${statusText}*`,
        "",
        `*Stocks:* ${sanitizeForTelegramMarkdown(stockLabel)}`,
      ];
      if (job.costUsd !== undefined) {
        lines.push(`*Cost:* $${job.costUsd.toFixed(2)}`);
      }
      if (job.durationMs !== undefined) {
        lines.push(`*Duration:* ${formatDuration(job.durationMs)}`);
      }
      if (!isCompleted && job.error) {
        lines.push("", `Error: ${sanitizeForTelegramMarkdown(job.error)}`);
      }
      if (viewUrl) {
        lines.push("", `[View Full Research](${viewUrl})`);
      }

      await ctx.runAction(
        internal.notifications.actions.sendTelegramMessage.sendTelegramMessage,
        {
          text: lines.join("\n"),
          disablePreview: true,
        }
      );
    }

    // --- Email ---
    if (emailEnabled === "true") {
      const subject = `${statusEmoji} Research ${statusText}: ${stockLabel}`;
      const html = buildResearchEmailHtml({
        statusText,
        statusEmoji,
        stockLabel,
        costUsd: job.costUsd,
        durationMs: job.durationMs,
        error: job.error,
        viewUrl,
        createdAt: job.createdAt,
      });

      await ctx.runAction(internal.notifications.actions.sendEmail.sendEmail, {
        subject,
        html,
      });
    }
  },
});
