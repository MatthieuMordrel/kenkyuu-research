import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateCustomFields, validatePromptInput } from "../../validation";
import { logAuditEvent } from "../../auditLog";
import { customFieldDefinitionValidator } from "../../customFields";
import {
  assertModelActive,
  jobFieldsForModel,
  modelIdValidator,
  providerValidator,
  resolveMutationModelId,
} from "../../providers/constants";
import { promptType } from "../shared/promptType";

/** Create a new research prompt. */
export const createPrompt = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    type: promptType,
    template: v.string(),
    customFields: v.optional(v.array(customFieldDefinitionValidator)),
    defaultModelId: v.optional(modelIdValidator),
    defaultProvider: v.optional(providerValidator),
    isBuiltIn: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validatePromptInput(args);
    validateCustomFields(args.customFields);

    const resolvedModelId = resolveMutationModelId({
      modelId: args.defaultModelId,
      provider: args.defaultProvider,
    });
    assertModelActive(resolvedModelId);
    const { modelId, provider } = jobFieldsForModel(resolvedModelId);

    const now = Date.now();
    const id = await ctx.db.insert("prompts", {
      name: args.name,
      description: args.description,
      type: args.type,
      template: args.template,
      customFields: args.customFields,
      defaultModelId: modelId,
      defaultProvider: provider,
      isBuiltIn: args.isBuiltIn ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      action: "prompt.create",
      resourceType: "prompts",
      resourceId: id,
      details: args.name,
    });
    return id;
  },
});
