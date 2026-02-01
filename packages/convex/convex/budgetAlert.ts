"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Check if the current month's cost exceeds the budget threshold
 * and notify the user if so. Called after each cost log entry.
 */
export const checkBudgetAlert = internalAction({
  args: {
    currentCostUsd: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get the budget threshold from settings
    const thresholdStr: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "budget_threshold" },
    );

    if (!thresholdStr) return; // No threshold configured

    const threshold = parseFloat(thresholdStr);
    if (isNaN(threshold) || threshold <= 0) return;

    // Get the current month's total cost
    const monthlyCost = await ctx.runQuery(
      internal.costTracking.getMonthlyCostInternal,
      {},
    );

    if (monthlyCost.totalCost < threshold) return;

    // Check if we already sent an alert this month to avoid spamming
    const alertSentKey = `budget_alert_sent_${monthlyCost.monthStart}`;
    const alreadySent: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: alertSentKey },
    );

    if (alreadySent === "true") return;

    // Mark alert as sent for this month
    await ctx.runMutation(internal.costTracking.markBudgetAlertSent, {
      key: alertSentKey,
    });

    // Build alert message
    const percentage = Math.round((monthlyCost.totalCost / threshold) * 100);
    const telegramText = [
      `\u26a0\ufe0f Budget Alert`,
      `Monthly spend: $${monthlyCost.totalCost.toFixed(2)} / $${threshold.toFixed(2)} (${percentage}%)`,
      `Jobs this month: ${monthlyCost.jobCount}`,
      `Latest job cost: $${args.currentCostUsd.toFixed(2)}`,
    ].join("\n");

    const htmlBody = `
      <h2>\u26a0\ufe0f Budget Alert</h2>
      <p>Your monthly AI research spending has exceeded your budget threshold.</p>
      <ul>
        <li><strong>Monthly spend:</strong> $${monthlyCost.totalCost.toFixed(2)} / $${threshold.toFixed(2)} (${percentage}%)</li>
        <li><strong>Jobs this month:</strong> ${monthlyCost.jobCount}</li>
        <li><strong>Latest job cost:</strong> $${args.currentCostUsd.toFixed(2)}</li>
      </ul>
      <p>You can adjust your budget threshold in Settings.</p>
    `.trim();

    // Check enabled channels and send
    const telegramEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_telegram_enabled" },
    );
    const emailEnabled: string | null = await ctx.runQuery(
      internal.authHelpers.getSettingValue,
      { key: "notification_email_enabled" },
    );

    if (telegramEnabled === "true") {
      await ctx.runAction(internal.notifications.sendTelegramMessage, {
        text: telegramText,
      });
    }

    if (emailEnabled === "true") {
      await ctx.runAction(internal.notifications.sendEmail, {
        subject: `\u26a0\ufe0f Budget Alert: $${monthlyCost.totalCost.toFixed(2)} / $${threshold.toFixed(2)}`,
        html: htmlBody,
      });
    }
  },
});
