import { v } from "convex/values";
import { internalQuery } from "../../_generated/server";
import { getValidSession } from "../shared/getValidSession";

/** Internal session validation for use by actions. */
export const validateSessionInternal = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await getValidSession(ctx, args.token);

    if (!session) {
      return { valid: false } as const;
    }

    return { valid: true } as const;
  },
});
