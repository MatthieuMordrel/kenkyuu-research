"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger";

/** Sends an email to the configured notification address via Resend. */
export const sendEmail = internalAction({
  args: {
    subject: v.string(),
    html: v.string(),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const apiKey: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "resend_api_key" }
    );
    const toEmail: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "notification_email" }
    );

    if (!apiKey || !toEmail) {
      logger.warn("Email not configured, skipping notification");
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
      logger.error(`Resend API error (${response.status}): ${errorText}`);
      return { sent: false, reason: `api_error: ${response.status}` };
    }

    return { sent: true };
  },
});
