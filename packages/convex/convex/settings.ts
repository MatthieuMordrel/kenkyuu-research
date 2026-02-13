import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./authHelpers";
import { validateSettingInput } from "./validation";
import { logAuditEvent } from "./auditLog";

const PROTECTED_SETTING_KEYS = new Set([
  "auth_password_hash",
]);

export const getSetting = query({
  args: { key: v.string(), token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting?.value ?? null;
  },
});

export const upsertSetting = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    validateSettingInput(args.key, args.value);

    if (PROTECTED_SETTING_KEYS.has(args.key)) {
      throw new Error(`Setting "${args.key}" cannot be modified directly`);
    }

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      await logAuditEvent(ctx, { action: "settings.update", resourceType: "settings", details: args.key });
      return existing._id;
    }

    const id = await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
    });
    await logAuditEvent(ctx, { action: "settings.create", resourceType: "settings", details: args.key });
    return id;
  },
});
