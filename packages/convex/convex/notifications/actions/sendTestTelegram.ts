"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Sends a test Telegram message to verify the notification setup. */
export const sendTestTelegram = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const session = await ctx.runQuery(
      internal.auth.queries.internalValidateSession.internalValidateSession,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    return await ctx.runAction(
      internal.notifications.actions.internalSendTelegramMessage
        .internalSendTelegramMessage,
      {
        text: "✅ Kenkyuu Test Message\n\nIf you're reading this, your Telegram notifications are working correctly.",
      }
    );
  },
});
