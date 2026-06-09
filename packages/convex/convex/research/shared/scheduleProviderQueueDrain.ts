import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { ProviderName } from "../../providers/constants";

/**
 * Schedules dispatch for the oldest pending job when a provider slot opens.
 */
export async function scheduleProviderQueueDrain(
  ctx: MutationCtx,
  provider: ProviderName
) {
  await ctx.scheduler.runAfter(
    0,
    internal.research.mutations.internalDrainProviderQueue
      .internalDrainProviderQueue,
    {
      provider,
    }
  );
}
