import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./authHelpers";
import { validatePromptInput } from "./validation";
import { logAuditEvent } from "./auditLog";

const promptType = v.union(
  v.literal("single-stock"),
  v.literal("multi-stock"),
  v.literal("discovery"),
);

// --- Mutations ---

export const createPrompt = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    type: promptType,
    template: v.string(),
    defaultProvider: v.optional(v.literal("openai")),
    isBuiltIn: v.optional(v.boolean()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validatePromptInput(args);

    const now = Date.now();
    const id = await ctx.db.insert("prompts", {
      name: args.name,
      description: args.description,
      type: args.type,
      template: args.template,
      defaultProvider: args.defaultProvider ?? "openai",
      isBuiltIn: args.isBuiltIn ?? false,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, { action: "prompt.create", resourceType: "prompts", resourceId: id, details: args.name });
    return id;
  },
});

export const updatePrompt = mutation({
  args: {
    id: v.id("prompts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(promptType),
    template: v.optional(v.string()),
    defaultProvider: v.optional(v.literal("openai")),
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
    if (updates.defaultProvider !== undefined)
      patch.defaultProvider = updates.defaultProvider;

    await ctx.db.patch(id, patch);
    await logAuditEvent(ctx, { action: "prompt.update", resourceType: "prompts", resourceId: id });
    return id;
  },
});

export const deletePrompt = mutation({
  args: { id: v.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }

    if (existing.isBuiltIn) {
      throw new Error("Cannot delete built-in prompts");
    }

    await ctx.db.delete(args.id);
    await logAuditEvent(ctx, { action: "prompt.delete", resourceType: "prompts", resourceId: args.id, details: existing.name });
  },
});

export const clonePrompt = mutation({
  args: { id: v.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Prompt not found");
    }

    const now = Date.now();
    return await ctx.db.insert("prompts", {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      type: existing.type,
      template: existing.template,
      defaultProvider: existing.defaultProvider,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// --- Queries ---

export const listPrompts = query({
  args: {
    type: v.optional(promptType),
    limit: v.optional(v.number()),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const maxResults = Math.min(args.limit ?? 200, 200);
    let prompts = await ctx.db.query("prompts").take(maxResults);

    if (args.type) {
      prompts = prompts.filter((p) => p.type === args.type);
    }

    // Sort: built-in first, then by createdAt descending
    prompts.sort((a, b) => {
      if (a.isBuiltIn !== b.isBuiltIn) {
        return a.isBuiltIn ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });

    return prompts;
  },
});

export const getPrompt = query({
  args: { id: v.id("prompts"), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});
