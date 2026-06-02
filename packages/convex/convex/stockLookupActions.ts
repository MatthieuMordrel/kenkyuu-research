"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mapFinnhubExchange } from "./lib/finnhub/mapExchange";
import { rankSearchResults } from "./lib/finnhub/rankSearchResults";
import type {
  FinnhubCompanyProfile,
  FinnhubSearchResponse,
  ResolvedStockSymbol,
  SymbolSuggestion,
} from "./lib/finnhub/types";
import { validateSearchTerm } from "./validation";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 50;

async function requireValidSession(
  ctx: ActionCtx,
  token: string
): Promise<void> {
  const session = await ctx.runQuery(
    internal.authHelpers.validateSessionInternal,
    { token }
  );
  if (!session.valid) {
    throw new Error("Unauthorized");
  }
}

async function getFinnhubApiKey(ctx: ActionCtx): Promise<string | null> {
  return (
    (await ctx.runQuery(internal.authHelpers.getSettingValue, {
      key: "FINNHUB_API_KEY",
    })) ?? process.env.FINNHUB_API_KEY ?? null
  );
}

function normalizeLookupQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) {
    throw new Error(`Query must be at least ${MIN_QUERY_LENGTH} characters`);
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query must be at most ${MAX_QUERY_LENGTH} characters`);
  }
  validateSearchTerm(trimmed);
  return trimmed;
}

export const searchStockSymbols = action({
  args: {
    token: v.string(),
    query: v.string(),
  },
  handler: async (ctx, args): Promise<{
    configured: boolean;
    results: SymbolSuggestion[];
  }> => {
    await requireValidSession(ctx, args.token);

    const apiKey = await getFinnhubApiKey(ctx);
    if (!apiKey) {
      return { configured: false, results: [] };
    }

    const query = normalizeLookupQuery(args.query);
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
    const response = await fetch(url);

    if (response.status === 429) {
      throw new Error("Symbol search rate limited. Try again in a moment.");
    }

    if (!response.ok) {
      throw new Error(`Symbol search failed (${response.status})`);
    }

    const data = (await response.json()) as FinnhubSearchResponse;
    return {
      configured: true,
      results: rankSearchResults(data.result ?? [], query),
    };
  },
});

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
