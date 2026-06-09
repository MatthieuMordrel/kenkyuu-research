"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { mapFinnhubExchange } from "../../lib/finnhub/mapExchange";
import type {
  FinnhubCompanyProfile,
  ResolvedStockSymbol,
} from "../../lib/finnhub/types";
import { requireValidSession } from "../shared/requireValidSession";
import { getFinnhubApiKey } from "../shared/getFinnhubApiKey";
import { MAX_QUERY_LENGTH } from "../shared/maxQueryLength";

/** Resolve a Finnhub symbol to ticker, company name, exchange, and sector. */
export const resolveStockSymbol = action({
  args: {
    token: v.string(),
    finnhubSymbol: v.string(),
  },
  handler: async (ctx, args): Promise<ResolvedStockSymbol> => {
    await requireValidSession(ctx, args.token);

    const apiKey = await getFinnhubApiKey(ctx);
    if (!apiKey) {
      throw new Error("Finnhub API key not configured");
    }

    const finnhubSymbol = args.finnhubSymbol.trim();
    if (!finnhubSymbol) {
      throw new Error("Symbol is required");
    }
    if (finnhubSymbol.length > MAX_QUERY_LENGTH) {
      throw new Error(`Symbol must be at most ${MAX_QUERY_LENGTH} characters`);
    }

    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(finnhubSymbol)}&token=${apiKey}`;
    const response = await fetch(url);

    if (response.status === 429) {
      throw new Error("Symbol lookup rate limited. Try again in a moment.");
    }

    if (!response.ok) {
      throw new Error(`Symbol lookup failed (${response.status})`);
    }

    const profile = (await response.json()) as FinnhubCompanyProfile;
    const mappedExchange = mapFinnhubExchange(profile.exchange);
    const ticker = (profile.ticker ?? finnhubSymbol).trim().toUpperCase();
    const companyName = (profile.name ?? "").trim();

    if (!companyName) {
      throw new Error("Could not resolve company name for this symbol");
    }

    return {
      ticker,
      companyName,
      exchange: mappedExchange ?? "",
      sector: profile.finnhubIndustry?.trim() || undefined,
      exchangeUnmapped: mappedExchange === null,
    };
  },
});
