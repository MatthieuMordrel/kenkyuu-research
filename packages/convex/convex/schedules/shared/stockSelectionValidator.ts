import { v } from "convex/values";
import { vv } from "../../schema";

/** Validator for a schedule's stock selection mode. */
export const stockSelectionValidator = v.object({
  type: v.union(
    v.literal("all"),
    v.literal("tagged"),
    v.literal("specific"),
    v.literal("none")
  ),
  tags: v.optional(v.array(v.string())),
  stockIds: v.optional(v.array(vv.id("stocks"))),
});
