import { describe, expect, it } from "vitest";
import {
  buildAllProviderConcurrencySnapshots,
  buildProviderConcurrencySnapshot,
  countActiveJobs,
  countSubmittedJobs,
  hasAdmissionSlot,
  hasDispatchSlot,
  openAiStartStaggerMs,
} from "../researchConcurrency";
import type { ConcurrencyJob } from "../researchConcurrency";

function job(
  provider: ConcurrencyJob["provider"],
  status: ConcurrencyJob["status"],
  externalJobId?: string
): ConcurrencyJob {
  return { provider, status, externalJobId };
}

describe("researchConcurrency", () => {
  it("counts active and submitted jobs per provider", () => {
    const jobs = [
      job("openai", "pending"),
      job("openai", "running"),
      job("openai", "running", "resp_1"),
      job("anthropic", "running", "batch_1"),
      job("anthropic", "completed"),
    ];

    expect(countActiveJobs(jobs, "openai")).toBe(3);
    expect(countSubmittedJobs(jobs, "openai")).toBe(1);
    expect(countActiveJobs(jobs, "anthropic")).toBe(1);
    expect(countSubmittedJobs(jobs, "anthropic")).toBe(1);
  });

  it("detects dispatch and admission slots from limits", () => {
    const openAiJobs = Array.from({ length: 10 }, (_, index) =>
      job("openai", "running", `resp_${index}`)
    );

    expect(hasDispatchSlot(openAiJobs, "openai")).toBe(false);
    expect(hasAdmissionSlot(openAiJobs, "openai")).toBe(false);

    const nineSubmitted = openAiJobs.slice(0, 9);
    expect(hasDispatchSlot(nineSubmitted, "openai")).toBe(true);
    expect(hasAdmissionSlot(nineSubmitted, "openai")).toBe(true);

    const withPending = [...nineSubmitted, job("openai", "pending")];
    expect(hasDispatchSlot(withPending, "openai")).toBe(true);
    expect(hasAdmissionSlot(withPending, "openai")).toBe(false);
  });

  it("builds provider snapshots", () => {
    const jobs = [
      job("openai", "pending"),
      job("openai", "running", "resp_1"),
      job("anthropic", "pending"),
      job("anthropic", "pending"),
    ];

    expect(buildProviderConcurrencySnapshot(jobs, "openai")).toEqual({
      pending: 1,
      running: 1,
      submitted: 1,
      active: 2,
      limit: 10,
      atCapacity: false,
      hasDispatchSlot: true,
    });

    const all = buildAllProviderConcurrencySnapshots(jobs);
    expect(all.anthropic.pending).toBe(2);
    expect(all.anthropic.limit).toBe(15);
  });

  it("staggers OpenAI starts based on submitted count", () => {
    expect(openAiStartStaggerMs(0)).toBe(0);
    expect(openAiStartStaggerMs(3)).toBe(30_000);
  });
});
