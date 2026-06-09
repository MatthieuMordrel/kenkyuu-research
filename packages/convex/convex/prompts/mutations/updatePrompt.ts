import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { vv } from "../../schema";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validatePromptInput } from "../../validation";
import { logAuditEvent } from "../../auditLog";
import {
  assertModelActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
} from "../../providers/constants";
import { promptType } from "../shared/promptType";

/** Update an existing research prompt. */
export const updatePrompt = mutation({
  args: {
    id: vv.id("prompts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(promptType),
    template: v.optional(v.string()),
    defaultModelId: v.optional(modelIdValidator),
    defaultProvider: v.optional(providerValidator),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validatePromptInput(args);

    const { id, token: _token, ...updates } = args;

    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Prompt not found");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.description !== undefined)
      patch.description = updates.description;
    if (updates.type !== undefined) patch.type = updates.type;
    if (updates.template !== undefined) patch.template = updates.template;
    if (
      updates.defaultModelId !== undefined ||
      updates.defaultProvider !== undefined
    ) {
      const resolvedModelId = resolveMutationModelId({
        modelId: updates.defaultModelId ?? existing.defaultModelId,
        provider: updates.defaultProvider ?? existing.defaultProvider,
      });
      assertModelActive(resolvedModelId);
      const fields = jobFieldsForModel(resolvedModelId);
      patch.defaultModelId = fields.modelId;
      patch.defaultProvider = fields.provider;
    }

    await ctx.db.patch(id, patch);
    await logAuditEvent(ctx, {
      action: "prompt.update",
      resourceType: "prompts",
      resourceId: id,
    });
    return id;
  },
});
