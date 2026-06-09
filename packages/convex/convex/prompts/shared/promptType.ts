import { v } from "convex/values";

/** Validator for the kind of research prompt. */
export const promptType = v.union(
  v.literal("single-stock"),
  v.literal("multi-stock"),
  v.literal("discovery")
);
