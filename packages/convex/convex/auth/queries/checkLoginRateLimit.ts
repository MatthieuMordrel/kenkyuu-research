import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { computeLoginRateLimit } from "../shared/computeLoginRateLimit";

/** Checks whether the identifier is within the failed-login rate limit window. */
export const checkLoginRateLimit = internalQuery({
  args: { identifier: v.string() },
  handler: async (ctx, args) => {
    return await computeLoginRateLimit(ctx, args.identifier);
  },
});
