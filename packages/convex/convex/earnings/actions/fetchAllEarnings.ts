"use node";

import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { mapSequentially } from "../../lib/asyncIterators";
import { logger } from "../../lib/logger";
import { formatDate } from "../shared/formatDate";
import { sleepMs } from "../shared/sleepMs";

/** Fetch upcoming/recent earnings for every stock from Finnhub and upsert them. */
export const fetchAllEarnings = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check settings table first, then fall back to environment variable
    const apiKey =
      (await ctx.runQuery(
        internal.auth.queries.getSettingValue.getSettingValue,
        {
          key: "FINNHUB_API_KEY",
        }
      )) ?? process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      logger.error(
        "Finnhub API key not configured. Set 'FINNHUB_API_KEY' as an environment variable or in the settings table."
      );
      return;
    }

    const stocks = await ctx.runQuery(
      internal.earnings.queries.listAllStocksInternal.listAllStocksInternal,
      {}
    );

    if (stocks.length === 0) {
      logger.warn("No stocks found, skipping earnings fetch.");
      return;
    }

    const now = new Date();
    const from = new Date(now);
    from.setMonth(from.getMonth() - 3);
    const to = new Date(now);
    to.setMonth(to.getMonth() + 6);

    const fromStr = formatDate(from);
    const toStr = formatDate(to);

    logger.info(
      `Fetching earnings for ${stocks.length} stocks from ${fromStr} to ${toStr}`
    );

    // Finnhub free tier: ~60 req/min, so stocks are fetched strictly one at a
    // time with a sleep between requests (~54 req/min).
    for await (const _ of mapSequentially(stocks, async (stock) => {
      try {
        const url = `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(stock.ticker)}&from=${fromStr}&to=${toStr}&token=${apiKey}`;
        const response = await fetch(url);

        if (!response.ok) {
          logger.error(
            `Finnhub API error for ${stock.ticker}: ${response.status} ${response.statusText}`
          );
          await sleepMs(1100);
          return;
        }

        const data = (await response.json()) as {
          earningsCalendar?: Array<{
            date: string;
            epsEstimate: number | null;
            epsActual: number | null;
            revenueEstimate: number | null;
            revenueActual: number | null;
            hour: string;
            quarter: number;
            year: number;
            symbol: string;
          }>;
        };

        const entries = (data.earningsCalendar ?? [])
          .filter((e) => e.symbol === stock.ticker)
          .map((e) => ({
            date: e.date,
            epsEstimate: e.epsEstimate ?? undefined,
            epsActual: e.epsActual ?? undefined,
            revenueEstimate: e.revenueEstimate ?? undefined,
            revenueActual: e.revenueActual ?? undefined,
            hour: e.hour || undefined,
            quarter: e.quarter,
            year: e.year,
          }));

        if (entries.length > 0) {
          await ctx.runMutation(
            internal.earnings.mutations.upsertEarnings.upsertEarnings,
            {
              stockId: stock._id,
              symbol: stock.ticker,
              entries,
            }
          );
          logger.info(
            `Upserted ${entries.length} earnings for ${stock.ticker}`
          );
        } else {
          logger.info(`No earnings found for ${stock.ticker}`);
        }
      } catch (error) {
        logger.error(`Error fetching earnings for ${stock.ticker}:`, error);
      }

      // Rate limit: ~54 requests/min to stay under 60/min
      await sleepMs(1100);
    })) {
      // Sequential iteration only; results are not used.
    }

    logger.info("Earnings fetch complete.");
  },
});
