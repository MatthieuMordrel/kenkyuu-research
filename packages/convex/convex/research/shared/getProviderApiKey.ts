"use node";

import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { getSettingsKeyForProvider, type ProviderName } from "../../providers";

/** Reads the configured API key for a research provider from settings. */
export async function getProviderApiKey(
  ctx: ActionCtx,
  providerId: ProviderName
): Promise<string | null> {
  return await ctx.runQuery(
    internal.auth.queries.internalGetSettingValue.internalGetSettingValue,
    {
      key: getSettingsKeyForProvider(providerId),
    }
  );
}
