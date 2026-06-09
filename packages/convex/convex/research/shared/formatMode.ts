import { v } from "convex/values";

/** Validator for the formatting mode: live pipeline pass vs. backfill reformat. */
export const formatMode = v.union(v.literal("pipeline"), v.literal("backfill"));
