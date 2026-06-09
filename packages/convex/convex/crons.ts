import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "fetch-earnings",
  { hourUTC: 6, minuteUTC: 0 },
  internal.earnings.actions.fetchAllEarnings.fetchAllEarnings
);

// Recover research jobs whose webhooks were missed.
// Runs every 15 minutes, checks for jobs stuck in "running" for >30 min,
// polls OpenAI for their actual status, and processes the result.
crons.interval(
  "recover-stale-jobs",
  { minutes: 15 },
  internal.research.actions.recoverStaleJobs.recoverStaleJobs
);

// Recover research jobs stuck in formatting (action timeout, missed scheduler, etc.).
crons.interval(
  "recover-stale-formatting",
  { minutes: 15 },
  internal.research.actions.recoverStaleFormatting.recoverStaleFormatting
);

// Check earnings-based schedule triggers every hour.
// Evaluates all earnings-type schedules against current earnings data
// and creates research jobs for stocks with matching earnings dates.
crons.interval(
  "check-earnings-triggers",
  { hours: 1 },
  internal.earnings.actions.checkEarningsTriggers.checkEarningsTriggers
);

export default crons;
