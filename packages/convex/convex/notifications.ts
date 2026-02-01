"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// --- Telegram ---

export const sendTelegramMessage = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: boolean; reason?: string }> => {
    const botToken: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "telegram_bot_token" },
    );
    const chatId: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "telegram_chat_id" },
    );

    if (!botToken || !chatId) {
      console.log("Telegram not configured, skipping notification");
      return { sent: false, reason: "not_configured" };
    }

    const url: string = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response: Response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: args.text,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram API error (${response.status}): ${errorText}`);
      return { sent: false, reason: `api_error: ${response.status}` };
    }

    return { sent: true };
  },
});

// --- Email (Resend) ---

export const sendEmail = internalAction({
  args: {
    subject: v.string(),
    html: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: boolean; reason?: string }> => {
    const apiKey: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "resend_api_key" },
    );
    const toEmail: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email" },
    );

    if (!apiKey || !toEmail) {
      console.log("Email not configured, skipping notification");
      return { sent: false, reason: "not_configured" };
    }

    const response: Response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "KenkyuStock <notifications@kenkyustock.com>",
        to: [toEmail],
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend API error (${response.status}): ${errorText}`);
      return { sent: false, reason: `api_error: ${response.status}` };
    }

    return { sent: true };
  },
});

// --- Dispatch Logic ---

/**
 * Dispatches notifications to all enabled channels after a research job
 * completes or fails. Called from the webhook handler or job completion flow.
 */
export const dispatchJobNotification = internalAction({
  args: {
    jobId: v.id("researchJobs"),
  },
  handler: async (ctx, args): Promise<void> => {
    const job = await ctx.runQuery(internal.researchJobs.getJobInternal, {
      id: args.jobId,
    });
    if (!job) return;

    // Only notify for completed or failed jobs
    if (job.status !== "completed" && job.status !== "failed") return;

    // Check enabled channels
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_telegram_enabled" },
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email_enabled" },
    );

    // Resolve stock names for the message
    const stocks = await Promise.all(
      job.stockIds.map((id) =>
        ctx.runQuery(internal.researchJobs.getStockInternal, { id }),
      ),
    );
    const stockTickers = stocks
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => s.ticker);

    const stockLabel =
      stockTickers.length > 0
        ? stockTickers.join(", ")
        : "Discovery research";

    // Build notification content
    const isCompleted = job.status === "completed";
    const statusEmoji = isCompleted ? "\u2705" : "\u274c";
    const statusText = isCompleted ? "completed" : "failed";

    // Extract a brief summary for the notification
    let summary = "";
    if (isCompleted && job.result) {
      summary = job.result.substring(0, 300);
      if (job.result.length > 300) summary += "...";
    } else if (job.error) {
      summary = `Error: ${job.error}`;
    }

    const costLine =
      job.costUsd !== undefined
        ? `\nCost: $${job.costUsd.toFixed(2)}`
        : "";

    // --- Telegram ---
    if (telegramEnabled === "true") {
      const telegramText = [
        `${statusEmoji} Research ${statusText}: ${stockLabel}`,
        costLine,
        "",
        summary,
      ]
        .filter(Boolean)
        .join("\n");

      await ctx.runAction(internal.notifications.sendTelegramMessage, {
        text: telegramText,
      });
    }

    // --- Email ---
    if (emailEnabled === "true") {
      const subject = `${statusEmoji} Research ${statusText}: ${stockLabel}`;
      const html = `
        <h2>Research ${statusText}</h2>
        <p><strong>Stocks:</strong> ${stockLabel}</p>
        ${costLine ? `<p><strong>Cost:</strong> $${job.costUsd?.toFixed(2)}</p>` : ""}
        ${job.durationMs ? `<p><strong>Duration:</strong> ${Math.round(job.durationMs / 1000)}s</p>` : ""}
        <hr>
        <div style="white-space: pre-wrap;">${summary}</div>
      `.trim();

      await ctx.runAction(internal.notifications.sendEmail, {
        subject,
        html,
      });
    }
  },
});

/**
 * Batch notification dispatcher. Sends a single summary notification
 * for multiple jobs that completed in a short window.
 */
export const dispatchBatchNotification = internalAction({
  args: {
    jobIds: v.array(v.id("researchJobs")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.jobIds.length === 0) return;

    // If only one job, dispatch individually
    if (args.jobIds.length === 1) {
      await ctx.runAction(internal.notifications.dispatchJobNotification, {
        jobId: args.jobIds[0]!,
      });
      return;
    }

    // Fetch all jobs
    const jobs = await Promise.all(
      args.jobIds.map((id) =>
        ctx.runQuery(internal.researchJobs.getJobInternal, { id }),
      ),
    );
    const validJobs = jobs.filter(
      (j): j is NonNullable<typeof j> => j !== null,
    );

    const completed = validJobs.filter((j) => j.status === "completed");
    const failed = validJobs.filter((j) => j.status === "failed");

    // Check enabled channels
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_telegram_enabled" },
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email_enabled" },
    );

    const lines: string[] = [
      `\ud83d\udcca Research Batch Summary (${validJobs.length} jobs)`,
    ];
    if (completed.length > 0)
      lines.push(`\u2705 ${completed.length} completed`);
    if (failed.length > 0)
      lines.push(`\u274c ${failed.length} failed`);

    const totalCost = validJobs.reduce(
      (sum, j) => sum + (j.costUsd ?? 0),
      0,
    );
    if (totalCost > 0) lines.push(`Total cost: $${totalCost.toFixed(2)}`);

    const text = lines.join("\n");

    if (telegramEnabled === "true") {
      await ctx.runAction(internal.notifications.sendTelegramMessage, {
        text,
      });
    }

    if (emailEnabled === "true") {
      await ctx.runAction(internal.notifications.sendEmail, {
        subject: `Research Batch: ${completed.length} completed, ${failed.length} failed`,
        html: `<pre>${text}</pre>`,
      });
    }
  },
});
