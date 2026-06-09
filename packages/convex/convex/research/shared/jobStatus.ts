import { v } from "convex/values";

/** Validator for the lifecycle status of a research job. */
export const jobStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("formatting"),
  v.literal("completed"),
  v.literal("failed")
);
