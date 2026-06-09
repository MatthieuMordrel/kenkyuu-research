import { v } from "convex/values";

/** Validator for the earnings-trigger configuration of a schedule. */
export const earningsConfigValidator = v.object({
  offsetDays: v.number(),
  adjustForHour: v.boolean(),
  earningsMode: v.optional(
    v.union(
      v.literal("each"),
      v.literal("after_last"),
      v.literal("before_first")
    )
  ),
});
