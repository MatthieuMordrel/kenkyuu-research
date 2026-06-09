import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";

/** Throw if the given session token is not valid. */
export async function requireValidSession(
  ctx: ActionCtx,
  token: string
): Promise<void> {
  const session = await ctx.runQuery(
    internal.auth.queries.validateSessionInternal.validateSessionInternal,
    { token }
  );
  if (!session.valid) {
    throw new Error("Unauthorized");
  }
}
