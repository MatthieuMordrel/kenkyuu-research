"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// --- Telegram ---

export const sendTelegramMessage = internalAction({
  args: {
    text: v.string(),
    disablePreview: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const botToken: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "telegram_bot_token" }
    );
    const chatId: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "telegram_chat_id" }
    );

    if (!botToken || !chatId) {
      console.warn("Telegram not configured, skipping notification");
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
        disable_web_page_preview: args.disablePreview ?? false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram API error (${response.status}): ${errorText}`);
      let description = `${response.status}`;
      try {
        const body = JSON.parse(errorText);
        if (body.description) description = body.description;
      } catch {
        // use status code as fallback
      }
      return { sent: false, reason: description };
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
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const apiKey: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "resend_api_key" }
    );
    const toEmail: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email" }
    );

    if (!apiKey || !toEmail) {
      console.warn("Email not configured, skipping notification");
      return { sent: false, reason: "not_configured" };
    }

    const response: Response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.EMAIL_FROM ?? "KenkyuStock <notifications@mordrel.pro>",
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

/** @internal Exported for testing */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Email template helpers ---

/**
 * Sanitize untrusted text for Telegram's legacy Markdown parser.
 * Classic "Markdown" parse_mode (unlike MarkdownV2) has no escape sequence,
 * so any stray `*`, `_`, `` ` ``, or `[` in user-provided content (error
 * messages, stock labels) can corrupt the rest of the message. We strip them.
 */
function sanitizeForTelegramMarkdown(str: string): string {
  return str.replace(/[_*`[\]]/g, "");
}

function formatDuration(ms: number): string {
  if (ms >= 60000) {
    const min = Math.floor(ms / 60000);
    const sec = Math.round((ms % 60000) / 1000);
    return `${min}m ${sec}s`;
  }
  return `${Math.round(ms / 1000)}s`;
}

function buildResearchEmailHtml(opts: {
  statusText: string;
  statusEmoji: string;
  stockLabel: string;
  costUsd?: number;
  durationMs?: number;
  error?: string;
  viewUrl?: string;
  createdAt?: number;
}): string {
  const isCompleted = opts.statusText === "completed";
  const accentColor = isCompleted ? "#16a34a" : "#dc2626";
  const statusBg = isCompleted ? "#f0fdf4" : "#fef2f2";

  const metaRows: string[] = [];
  if (opts.costUsd !== undefined) {
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Cost</td><td style="padding:4px 0;font-weight:500;">$${opts.costUsd.toFixed(2)}</td>`
    );
  }
  if (opts.durationMs !== undefined) {
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Duration</td><td style="padding:4px 0;font-weight:500;">${formatDuration(opts.durationMs)}</td>`
    );
  }
  if (opts.createdAt) {
    const d = new Date(opts.createdAt);
    const dateStr = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    metaRows.push(
      `<td style="padding:4px 12px 4px 0;color:#6b7280;">Date</td><td style="padding:4px 0;font-weight:500;">${escapeHtml(dateStr)} at ${escapeHtml(timeStr)}</td>`
    );
  }

  const metaTable =
    metaRows.length > 0
      ? `<table style="border-collapse:collapse;font-size:14px;margin:16px 0;">${metaRows.map((r) => `<tr>${r}</tr>`).join("")}</table>`
      : "";

  const errorBlock = opts.error
    ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;color:#991b1b;">${escapeHtml(opts.error)}</div>`
    : "";

  const ctaButton = opts.viewUrl
    ? `<div style="margin:24px 0;text-align:center;">
        <a href="${escapeHtml(opts.viewUrl)}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View Full Research</a>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="text-align:center;padding-bottom:24px;">
      <span style="font-size:20px;font-weight:700;color:#111827;">Kenkyuu</span>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <!-- Status banner -->
      <div style="background:${statusBg};padding:20px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:28px;margin-bottom:4px;">${opts.statusEmoji}</div>
        <div style="font-size:18px;font-weight:600;color:${accentColor};text-transform:capitalize;">Research ${escapeHtml(opts.statusText)}</div>
      </div>

      <!-- Body -->
      <div style="padding:24px;">
        <div style="font-size:15px;color:#374151;margin-bottom:4px;">
          <span style="color:#6b7280;">Stocks:</span>
          <strong>${escapeHtml(opts.stockLabel)}</strong>
        </div>
        ${metaTable}
        ${errorBlock}
        ${ctaButton}
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:20px;font-size:12px;color:#9ca3af;">
      Sent by Kenkyuu Research
    </div>
  </div>
</body>
</html>`.trim();
}

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
      { key: "notification_telegram_enabled" }
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email_enabled" }
    );

    // Resolve stock names for the message
    const stocks = await Promise.all(
      job.stockIds.map((id) =>
        ctx.runQuery(internal.researchJobs.getStockInternal, { id })
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
      internal.authHelpers.getSettingValue,
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

      await ctx.runAction(internal.notifications.sendTelegramMessage, {
        text: lines.join("\n"),
        disablePreview: true,
      });
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
        ctx.runQuery(internal.researchJobs.getJobInternal, { id })
      )
    );
    const validJobs = jobs.filter(
      (j): j is NonNullable<typeof j> => j !== null
    );

    const completed = validJobs.filter((j) => j.status === "completed");
    const failed = validJobs.filter((j) => j.status === "failed");

    // Check enabled channels
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_telegram_enabled" }
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
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
      await ctx.runAction(internal.notifications.sendTelegramMessage, {
        text,
      });
    }

    if (emailEnabled === "true") {
      const appUrl: string | null = await ctx.runQuery(
        internal.authHelpers.getSettingValue,
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

      await ctx.runAction(internal.notifications.sendEmail, {
        subject: `Research Batch: ${completed.length} completed, ${failed.length} failed`,
        html,
      });
    }
  },
});

// --- Detect Telegram Chat ID ---

export const detectTelegramChatId = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ found: boolean; chatId?: string; reason?: string }> => {
    const session = await ctx.runQuery(
      internal.authHelpers.validateSessionInternal,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    const botToken: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "telegram_bot_token" }
    );

    if (!botToken) {
      return { found: false, reason: "Please set your bot token first." };
    }

    const url = `https://api.telegram.org/bot${botToken}/getUpdates?limit=10`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      let description = `${response.status}`;
      try {
        const body = JSON.parse(errorText);
        if (body.description) description = body.description;
      } catch {
        // use status code as fallback
      }
      return { found: false, reason: description };
    }

    const data = await response.json();
    if (!data.ok || !data.result || data.result.length === 0) {
      return {
        found: false,
        reason:
          "No messages found. Send /start to your bot on Telegram first, then try again.",
      };
    }

    // Get the chat ID from the most recent message
    const lastUpdate = data.result[data.result.length - 1];
    const chat =
      lastUpdate.message?.chat ?? lastUpdate.channel_post?.chat ?? null;

    if (!chat?.id) {
      return {
        found: false,
        reason:
          "Could not extract chat ID. Send /start to your bot on Telegram first, then try again.",
      };
    }

    return { found: true, chatId: String(chat.id) };
  },
});

// --- Test Telegram ---

export const sendTestTelegram = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const session = await ctx.runQuery(
      internal.authHelpers.validateSessionInternal,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    return await ctx.runAction(internal.notifications.sendTelegramMessage, {
      text: "✅ Kenkyuu Test Message\n\nIf you're reading this, your Telegram notifications are working correctly.",
    });
  },
});

// --- Test Email ---

export const sendTestEmail = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    // Validate session
    const session = await ctx.runQuery(
      internal.authHelpers.validateSessionInternal,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    return await ctx.runAction(internal.notifications.sendEmail, {
      subject: "Kenkyuu - Test Email",
      html: `
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
        <div style="font-size:28px;margin-bottom:4px;">\u2709\ufe0f</div>
        <div style="font-size:18px;font-weight:600;color:#1d4ed8;">Test Email</div>
      </div>
      <div style="padding:24px;text-align:center;">
        <p style="font-size:15px;color:#374151;margin:0;">If you're reading this, your email notifications are working correctly.</p>
      </div>
    </div>
    <div style="text-align:center;padding-top:20px;font-size:12px;color:#9ca3af;">
      Sent by Kenkyuu Research
    </div>
  </div>
</body>
</html>`.trim(),
    });
  },
});
