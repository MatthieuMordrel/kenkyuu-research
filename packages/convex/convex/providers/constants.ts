import { v } from "convex/values";

export const PROVIDER_NAMES = ["openai", "anthropic"] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const providerValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic")
);

export const SETTING_KEY_BY_PROVIDER: Record<ProviderName, string> = {
  openai: "openai_api_key",
  anthropic: "anthropic_api_key",
};
