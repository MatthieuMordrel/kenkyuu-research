"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { rankSearchResults } from "../../lib/finnhub/rankSearchResults";
import type {
  FinnhubSearchResponse,
  SymbolSuggestion,
} from "../../lib/finnhub/types";
import { requireValidSession } from "../shared/requireValidSession";
import { getFinnhubApiKey } from "../shared/getFinnhubApiKey";
import { normalizeLookupQuery } from "../shared/normalizeLookupQuery";

/** Search Finnhub for stock symbols matching a free-text query. */
export const searchStockSymbols = action({
  args: {
    token: v.string(),
    query: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
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
