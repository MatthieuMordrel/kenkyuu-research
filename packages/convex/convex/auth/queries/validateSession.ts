import { v } from "convex/values";
import { query } from "../../_generated/server";
import { getValidSession } from "../shared/getValidSession";

/** Validates a session token, returning its expiry when valid. */
export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await getValidSession(ctx, args.token);

    if (!session) {
      return { valid: false } as const;
    }

    return { valid: true, expiresAt: session.expiresAt } as const;
  },
});
