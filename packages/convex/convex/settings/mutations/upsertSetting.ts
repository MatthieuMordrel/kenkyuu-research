import { v } from "convex/values";
import { mutation } from "../../_generated/server";
import { requireAuth } from "../../auth/shared/requireAuth";
import { validateSettingInput } from "../../validation";
import { logAuditEvent } from "../../auditLog";
import { PROTECTED_SETTING_KEYS } from "../shared/protectedSettingKeys";

/** Create or update a setting; protected keys cannot be modified directly. */
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
      await logAuditEvent(ctx, {
        action: "settings.update",
        resourceType: "settings",
        details: args.key,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
    });
    await logAuditEvent(ctx, {
      action: "settings.create",
      resourceType: "settings",
      details: args.key,
    });
    return id;
  },
});
