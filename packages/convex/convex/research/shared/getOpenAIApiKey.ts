import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { getSettingsKeyForProvider } from "../../providers/constants";

/** Reads the configured OpenAI API key from settings. */
export async function getOpenAIApiKey(ctx: ActionCtx): Promise<string | null> {
  return await ctx.runQuery(
    internal.auth.queries.getSettingValue.getSettingValue,
    {
      key: getSettingsKeyForProvider("openai"),
    }
  );
}
