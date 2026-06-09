"use node";

import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { logger } from "../../lib/logger";

/** Sends a message to the configured Telegram chat via the Bot API. */
export const sendTelegramMessage = internalAction({
  args: {
    text: v.string(),
    disablePreview: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ sent: boolean; reason?: string }> => {
    const botToken: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "telegram_bot_token" }
    );
    const chatId: string | null = await ctx.runQuery(
      internal.auth.queries.getSettingValue.getSettingValue,
      { key: "telegram_chat_id" }
    );

    if (!botToken || !chatId) {
      logger.warn("Telegram not configured, skipping notification");
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
      logger.error(`Telegram API error (${response.status}): ${errorText}`);
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
