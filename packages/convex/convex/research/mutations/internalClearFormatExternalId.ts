import { internalMutation } from "../../_generated/server";
import { vv } from "../../schema";

/** Clears the external id so a new format response can be submitted (guard retry). */
export const internalClearFormatExternalId = internalMutation({
  args: { id: vv.id("researchJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) {
      throw new Error("Research job not found");
    }

    await ctx.db.patch(args.id, { formatExternalId: undefined });
    return args.id;
  },
});
