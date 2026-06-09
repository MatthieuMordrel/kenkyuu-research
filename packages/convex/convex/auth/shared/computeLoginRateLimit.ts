import type { QueryCtx, MutationCtx } from "../../_generated/server";
import { RATE_LIMIT_WINDOW_MS } from "./rateLimitWindowMs";

const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Computes the failed-login rate limit state for an identifier over the
 * sliding rate limit window.
 */
export async function computeLoginRateLimit(
  ctx: QueryCtx | MutationCtx,
  identifier: string
): Promise<{
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}> {
  const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;

  const recentAttempts = await ctx.db
    .query("loginAttempts")
    .withIndex("by_identifier_timestamp", (q) =>
      q.eq("identifier", identifier).gte("timestamp", windowStart)
    )
    .collect();

  const failedAttempts = recentAttempts.filter((a) => !a.success);
  return {
    allowed: failedAttempts.length < MAX_LOGIN_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - failedAttempts.length),
    retryAfterMs:
      failedAttempts.length >= MAX_LOGIN_ATTEMPTS
        ? RATE_LIMIT_WINDOW_MS -
          (Date.now() - Math.min(...failedAttempts.map((a) => a.timestamp)))
        : 0,
  };
}
