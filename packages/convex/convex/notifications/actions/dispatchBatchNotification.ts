"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import { escapeHtml } from "../shared/escapeHtml";
import { formatDuration } from "../shared/formatDuration";

/**
 * Batch notification dispatcher. Sends a single summary notification
 * for multiple jobs that completed in a short window.
 */
export const dispatchBatchNotification = internalAction({
  args: {
    jobIds: v.array(vv.id("researchJobs")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.jobIds.length === 0) return;

    // If only one job, dispatch individually
    if (args.jobIds.length === 1) {
      await ctx.runAction(
        internal.notifications.actions.dispatchJobNotification
          .dispatchJobNotification,
        {
          jobId: args.jobIds[0]!,
        }
      );
      return;
    }

    // Fetch all jobs
    const jobs = await Promise.all(
      args.jobIds.map((id) =>
        ctx.runQuery(internal.research.queries.getJobInternal.getJobInternal, {
          id,
        })
      )
    );
    const validJobs = jobs.filter(
      (j): j is NonNullable<typeof j> => j !== null
    );

    const completed = validJobs.filter((j) => j.status === "completed");
    const failed = validJobs.filter((j) => j.status === "failed");

    // Check enabled channels
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "notification_telegram_enabled" }
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "notification_email_enabled" }
    );

    const lines: string[] = [
      `\ud83d\udcca Research Batch Summary (${validJobs.length} jobs)`,
    ];
    if (completed.length > 0)
      lines.push(`\u2705 ${completed.length} completed`);
    if (failed.length > 0) lines.push(`\u274c ${failed.length} failed`);

    const totalCost = validJobs.reduce((sum, j) => sum + (j.costUsd ?? 0), 0);
    if (totalCost > 0) lines.push(`Total cost: $${totalCost.toFixed(2)}`);

    const text = lines.join("\n");

    if (telegramEnabled === "true") {
      await ctx.runAction(
        internal.notifications.actions.sendTelegramMessage.sendTelegramMessage,
        {
          text,
        }
      );
    }

    if (emailEnabled === "true") {
      const appUrl: string | null = await ctx.runQuery(
        internal.auth.queries.getSettingValue.getSettingValue,
        { key: "app_url" }
      );
      const baseUrl = appUrl ? appUrl.replace(/\/+$/, "") : undefined;

      const totalDuration = validJobs.reduce(
        (sum, j) => sum + (j.durationMs ?? 0),
        0
      );

      const metaRows: string[] = [];
      if (totalCost > 0) {
        metaRows.push(
          `<td style="padding:4px 12px 4px 0;color:#6b7280;">Total Cost</td><td style="padding:4px 0;font-weight:500;">$${totalCost.toFixed(2)}</td>`
        );
      }
      if (totalDuration > 0) {
        metaRows.push(
          `<td style="padding:4px 12px 4px 0;color:#6b7280;">Total Duration</td><td style="padding:4px 0;font-weight:500;">${formatDuration(totalDuration)}</td>`
        );
      }
      const metaTable =
        metaRows.length > 0
          ? `<table style="border-collapse:collapse;font-size:14px;margin:16px 0;">${metaRows.map((r) => `<tr>${r}</tr>`).join("")}</table>`
          : "";

      const jobRows = validJobs
        .map((j) => {
          const emoji = j.status === "completed" ? "\u2705" : "\u274c";
          const link = baseUrl
            ? `<a href="${baseUrl}/research/${j._id}" style="color:#2563eb;text-decoration:none;">View</a>`
            : "";
          return `<tr>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #f3f4f6;">${emoji}</td>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #f3f4f6;font-weight:500;">${escapeHtml(j.status)}</td>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;">${j.costUsd !== undefined ? "$" + j.costUsd.toFixed(2) : "—"}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${link}</td>
        </tr>`;
        })
        .join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <div style="text-align:center;padding-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:#111827;">Kenkyuu</span>
    </div>
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <div style="background:#eff6ff;padding:20px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:28px;margin-bottom:4px;">\ud83d\udcca</div>
        <div style="font-size:18px;font-weight:600;color:#1d4ed8;">Batch Summary</div>
        <div style="font-size:14px;color:#6b7280;margin-top:4px;">${validJobs.length} research jobs</div>
      </div>
      <div style="padding:24px;">
        <div style="font-size:14px;margin-bottom:12px;">
          ${completed.length > 0 ? `<span style="color:#16a34a;font-weight:500;">\u2705 ${completed.length} completed</span>` : ""}
          ${completed.length > 0 && failed.length > 0 ? `<span style="margin:0 8px;color:#d1d5db;">&middot;</span>` : ""}
          ${failed.length > 0 ? `<span style="color:#dc2626;font-weight:500;">\u274c ${failed.length} failed</span>` : ""}
        </div>
        ${metaTable}
        <table style="border-collapse:collapse;font-size:13px;width:100%;margin-top:16px;">
          <thead><tr style="text-align:left;">
            <th style="padding:6px 12px 6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-weight:500;font-size:12px;"></th>
            <th style="padding:6px 12px 6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-weight:500;font-size:12px;">Status</th>
            <th style="padding:6px 12px 6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-weight:500;font-size:12px;">Cost</th>
            <th style="padding:6px 0;border-bottom:2px solid #e5e7eb;color:#9ca3af;font-weight:500;font-size:12px;"></th>
          </tr></thead>
          <tbody>${jobRows}</tbody>
        </table>
        ${
          baseUrl
            ? `<div style="margin:24px 0 0;text-align:center;">
          <a href="${baseUrl}/research" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View All Research</a>
        </div>`
            : ""
        }
      </div>
    </div>
    <div style="text-align:center;padding-top:20px;font-size:12px;color:#9ca3af;">
      Sent by Kenkyuu Research
    </div>
  </div>
</body>
</html>`.trim();

      await ctx.runAction(internal.notifications.actions.sendEmail.sendEmail, {
        subject: `Research Batch: ${completed.length} completed, ${failed.length} failed`,
        html,
      });
    }
  },
});
