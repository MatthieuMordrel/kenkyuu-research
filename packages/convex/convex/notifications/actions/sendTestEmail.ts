"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Sends a test email to verify the notification setup. */
export const sendTestEmail = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    // Validate session
    const session = await ctx.runQuery(
      internal.auth.queries.internalValidateSession.internalValidateSession,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    return await ctx.runAction(
      internal.notifications.actions.internalSendEmail.internalSendEmail,
      {
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
      }
    );
  },
});
