import { internalQuery } from "../../_generated/server";
import { asConcurrencyJobs } from "../../researchConcurrency";
import { loadActiveJobsForConcurrency } from "../shared/loadActiveJobsForConcurrency";

/** Active jobs used by dispatch logic in researchActions. */
export const internalGetConcurrencyJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const activeJobs = await loadActiveJobsForConcurrency(ctx);
    return asConcurrencyJobs(activeJobs);
  },
});
