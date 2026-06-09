import type { QueryCtx, MutationCtx } from "../../_generated/server";

/**
 * Validates that a session token is present and valid.
 * Throws "Unauthorized" if the token is missing, invalid, or expired.
 * Use in all public queries and mutations to enforce authentication.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined
): Promise<void> {
  if (!token) {
    throw new Error("Unauthorized");
  }

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();

  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Unauthorized");
  }
}
