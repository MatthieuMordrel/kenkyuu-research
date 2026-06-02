import type { ProviderName } from "./providers/constants";

/**
 * Max concurrent research jobs per provider.
 * Derived from OpenAI Tier 4 (GPT-5.5) and Anthropic Tier 3 (Opus batch).
 * Lower `openai` if re-enabling Deep Research models.
 */
export const MAX_JOBS_BY_PROVIDER = {
  openai: 10,
  anthropic: 15,
} as const satisfies Record<ProviderName, number>;

/** Providers with configured concurrency limits. */
export const CONCURRENCY_PROVIDERS = Object.keys(
  MAX_JOBS_BY_PROVIDER
) as ProviderName[];

/** Delay before retrying dispatch when a provider is at capacity. */
export const DISPATCH_RETRY_DELAY_MS = 30_000;

/** Stagger between OpenAI job submissions to reduce TPM spikes. */
export const OPENAI_START_STAGGER_MS = 10_000;

/** Upper bound when scanning pending/running jobs from the database. */
export const MAX_ACTIVE_JOBS_SCAN = 50;

/** Job fields required for concurrency calculations. */
export interface ConcurrencyJob {
  /** Denormalized provider id on the research job. */
  provider: ProviderName;
  /** Convex job lifecycle status (only pending/running are passed in). */
  status: "pending" | "running";
  /** Set once the provider API call has been submitted. */
  externalJobId?: string;
}

/**
 * Narrows full research job rows to the shape used by concurrency helpers.
 */
export function asConcurrencyJobs(
  jobs: readonly {
    provider: ProviderName;
    status: string;
    externalJobId?: string;
  }[]
): ConcurrencyJob[] {
  return jobs
    .filter(
      (job): job is ConcurrencyJob =>
        job.status === "pending" || job.status === "running"
    )
    .map((job) => ({
      provider: job.provider,
      status: job.status,
      externalJobId: job.externalJobId,
    }));
}

/** Per-provider concurrency snapshot exposed to queries and actions. */
export interface ProviderConcurrencySnapshot {
  /** Jobs waiting to be submitted. */
  pending: number;
  /** Jobs marked running in Convex (includes not-yet-submitted). */
  running: number;
  /** Running jobs that have an external provider id. */
  submitted: number;
  /** Pending + running — used for admission and dispatch caps. */
  active: number;
  /** Configured max in-flight jobs for this provider. */
  limit: number;
  /** True when active >= limit. */
  atCapacity: boolean;
  /** True when a new job can be submitted to the provider API now. */
  hasDispatchSlot: boolean;
}

/**
 * Returns the configured in-flight limit for a provider.
 */
export function getProviderLimit(provider: ProviderName): number {
  return MAX_JOBS_BY_PROVIDER[provider];
}

/**
 * Counts pending + running jobs for a provider.
 */
export function countActiveJobs(
  jobs: readonly ConcurrencyJob[],
  provider: ProviderName
): number {
  return jobs.filter(
    (job) =>
      job.provider === provider &&
      (job.status === "pending" || job.status === "running")
  ).length;
}

/**
 * Counts running jobs that have been submitted to the provider API.
 */
export function countSubmittedJobs(
  jobs: readonly ConcurrencyJob[],
  provider: ProviderName
): number {
  return jobs.filter(
    (job) =>
      job.provider === provider &&
      job.status === "running" &&
      job.externalJobId !== undefined
  ).length;
}

/**
 * Returns true when another job can be submitted to the provider API.
 * Uses submitted running jobs as the dispatch gate (same numeric cap as admission).
 */
export function hasDispatchSlot(
  jobs: readonly ConcurrencyJob[],
  provider: ProviderName
): boolean {
  return countSubmittedJobs(jobs, provider) < getProviderLimit(provider);
}

/**
 * Returns true when another job can enter the pending/running queue for a provider.
 */
export function hasAdmissionSlot(
  jobs: readonly ConcurrencyJob[],
  provider: ProviderName
): boolean {
  return countActiveJobs(jobs, provider) < getProviderLimit(provider);
}

/**
 * OpenAI-only stagger before calling the provider API.
 * Spreads submission timing when multiple jobs are already in flight.
 */
export function openAiStartStaggerMs(submittedOpenAiCount: number): number {
  return submittedOpenAiCount * OPENAI_START_STAGGER_MS;
}

/**
 * Builds a per-provider concurrency snapshot from active jobs.
 */
export function buildProviderConcurrencySnapshot(
  jobs: readonly ConcurrencyJob[],
  provider: ProviderName
): ProviderConcurrencySnapshot {
  const pending = jobs.filter(
    (job) => job.provider === provider && job.status === "pending"
  ).length;
  const running = jobs.filter(
    (job) => job.provider === provider && job.status === "running"
  ).length;
  const submitted = countSubmittedJobs(jobs, provider);
  const active = pending + running;
  const limit = getProviderLimit(provider);

  return {
    pending,
    running,
    submitted,
    active,
    limit,
    atCapacity: active >= limit,
    hasDispatchSlot: submitted < limit,
  };
}

/**
 * Builds concurrency snapshots for every configured provider.
 */
export function buildAllProviderConcurrencySnapshots(
  jobs: readonly ConcurrencyJob[]
): Record<ProviderName, ProviderConcurrencySnapshot> {
  return {
    openai: buildProviderConcurrencySnapshot(jobs, "openai"),
    anthropic: buildProviderConcurrencySnapshot(jobs, "anthropic"),
  };
}
