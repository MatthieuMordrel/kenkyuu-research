import type Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import type { PollResult } from "../types";
import { collectCompletedResult } from "./collectCompletedResult";

type ManagedSession = Beta.Sessions.BetaManagedAgentsSession;

/** Outcome results that mean the report is ready to collect. */
const COMPLETED_OUTCOME_RESULTS = new Set([
  "satisfied",
  "max_iterations_reached",
]);

/**
 * An idle session is terminal for us only when its outcome evaluation is —
 * transient idles (e.g. between turns) keep polling until the hard timeout.
 */
export async function resolveIdleSession(
  client: Anthropic,
  session: ManagedSession
): Promise<PollResult> {
  const outcome = session.outcome_evaluations.at(-1);
  if (!outcome) {
    return {
      status: "failed",
      error: "Session is idle but no outcome was registered",
    };
  }

  if (COMPLETED_OUTCOME_RESULTS.has(outcome.result)) {
    return collectCompletedResult(client, session);
  }
  if (outcome.result === "failed") {
    return {
      status: "failed",
      error: outcome.explanation ?? "Outcome grading reported failure",
    };
  }
  if (outcome.result === "interrupted") {
    return { status: "cancelled" };
  }
  return { status: "running" };
}
