import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Resolve the Finnhub API key from settings or environment, if configured. */
export async function getFinnhubApiKey(ctx: ActionCtx): Promise<string | null> {
  return (
    (await ctx.runQuery(
      internal.auth.queries.internalGetSettingValue.internalGetSettingValue,
      {
        key: "FINNHUB_API_KEY",
      }
    )) ??
    process.env.FINNHUB_API_KEY ??
    null
  );
}
