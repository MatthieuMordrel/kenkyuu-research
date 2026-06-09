import { BUILT_IN_DISCOVERY_PROMPT } from "@repo/research-models/research-prompt";
import { internalMutation } from "../../_generated/server";

const BUILT_IN_PROMPTS = [
  {
    name: BUILT_IN_DISCOVERY_PROMPT.name,
    description: BUILT_IN_DISCOVERY_PROMPT.description,
    type: BUILT_IN_DISCOVERY_PROMPT.type,
    template: BUILT_IN_DISCOVERY_PROMPT.template,
    defaultModelId: "anthropic/claude-opus-4-8" as const,
    defaultProvider: "anthropic" as const,
    isBuiltIn: true,
  },
];

/** Seed the built-in prompts, skipping ones that already exist by name. */
export const internalSeedPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Prompts have distinct names, so each check-then-insert is independent.
    const insertedFlags = await Promise.all(
      BUILT_IN_PROMPTS.map(async (prompt) => {
        // Check existence by name using index instead of loading all prompts
        const existingPrompt = await ctx.db
          .query("prompts")
          .withIndex("by_name", (q) => q.eq("name", prompt.name))
          .first();
        if (existingPrompt) {
          return false;
        }
        await ctx.db.insert("prompts", {
          ...prompt,
          createdAt: now,
          updatedAt: now,
        });
        return true;
      })
    );

    const inserted = insertedFlags.filter(Boolean).length;
    return { inserted, skipped: BUILT_IN_PROMPTS.length - inserted };
  },
});
