"use node";

import { v } from "convex/values";
import { action } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { vv } from "../../schema";
import {
  getHarnessAdapter,
  resolveJobModel,
  type ProviderName,
} from "../../providers";
import { getProviderApiKey } from "../shared/getProviderApiKey";
import { isTerminal } from "../shared/isTerminal";
import { missingKeyMessage } from "../shared/missingKeyMessage";
import { statusMessage } from "../shared/statusMessage";

interface HealthCheckResult {
  jobId: string;
  convexStatus: string;
  providerStatus: string | null;
  provider: ProviderName;
  message: string;
  elapsedMs?: number;
  checkedAt: number;
}

/** User-facing liveness probe for a research job. */
export const checkJobHealth = action({
  args: {
    jobId: vv.id("researchJobs"),
    token: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<HealthCheckResult> => {
    if (!args.token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(
      internal.auth.queries.internalValidateSession.internalValidateSession,
      { token: args.token }
    );
    if (!session.valid) throw new Error("Unauthorized");

    const job = await ctx.runQuery(
      internal.research.queries.internalGetJob.internalGetJob,
      { id: args.jobId }
    );
    if (!job) throw new Error("Research job not found");

    const jobId = args.jobId as string;
    const now = Date.now();

    if (!job.externalJobId) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message:
          job.status === "pending"
            ? "Job is queued and has not been submitted yet."
            : "No external job ID found.",
        checkedAt: now,
      };
    }

    if (isTerminal(job.status)) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: job.status === "completed" ? "completed" : "failed",
        message: `Job already ${job.status}.`,
        checkedAt: now,
      };
    }

    const model = resolveJobModel(job);
    const adapter = getHarnessAdapter(model);
    const apiKey = await getProviderApiKey(ctx, model.providerId);
    if (!apiKey) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message: `${missingKeyMessage(model.providerId)} Cannot verify external status.`,
        checkedAt: now,
      };
    }

    try {
      const result = await adapter.poll(model, job.externalJobId, apiKey);
      const elapsedMs = now - job.createdAt;
      const elapsedMin = Math.floor(elapsedMs / 60_000);
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: result.status,
        elapsedMs,
        message: statusMessage(model, result, elapsedMin),
        checkedAt: now,
      };
    } catch (error) {
      return {
        jobId,
        provider: job.provider,
        convexStatus: job.status,
        providerStatus: null,
        message: `Failed to check provider status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        checkedAt: now,
      };
    }
  },
});
