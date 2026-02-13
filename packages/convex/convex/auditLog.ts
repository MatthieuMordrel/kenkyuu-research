import type { MutationCtx } from "./_generated/server";

/**
 * Logs an audit event for sensitive operations.
 * Call from mutation handlers after the operation succeeds.
 */
export async function logAuditEvent(
  ctx: MutationCtx,
  event: {
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: string;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    details: event.details,
    timestamp: Date.now(),
  });
}
