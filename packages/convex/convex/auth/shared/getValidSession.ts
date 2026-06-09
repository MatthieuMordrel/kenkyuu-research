import type { QueryCtx, MutationCtx } from "../../_generated/server";
import type { Doc } from "../../_generated/dataModel";

/**
 * Looks up a session by token and returns it only when it exists and has
 * not expired. Returns null otherwise.
 */
export async function getValidSession(
  ctx: QueryCtx | MutationCtx,
  token: string
): Promise<Doc<"sessions"> | null> {
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    return null;
  }

  return session;
}
