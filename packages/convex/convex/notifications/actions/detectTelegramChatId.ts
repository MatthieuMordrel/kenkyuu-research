"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Detects the Telegram chat ID from the bot's recent updates. */
export const detectTelegramChatId = action({
  args: { token: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ found: boolean; chatId?: string; reason?: string }> => {
    const session = await ctx.runQuery(
      internal.auth.queries.internalValidateSession.internalValidateSession,
      { token: args.token }
    );
    if (!session.valid) {
      throw new Error("Unauthorized");
    }

    const botToken: string | null = await ctx.runQuery(
      internal.auth.queries.internalGetSettingValue.internalGetSettingValue,
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
