import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "fetch-earnings",
  { hourUTC: 6, minuteUTC: 0 },
  internal.earningsActions.fetchAllEarnings,
);

export default crons;
