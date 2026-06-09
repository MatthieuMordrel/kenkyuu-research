"use node";

import Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import type { ResearchProviderAdapter, PollResult } from "./types";
import { RESEARCH_OUTCOME_RUBRIC } from "@repo/research-models/managed-agent-prompt";
import { ensureManagedAgentResources } from "./managedAgentProvisioning";

/**
 * Managed Agents harness adapter — Anthropic hosts the agent loop and a
 * per-session container; we create a session, send one rubric-graded outcome,
 * and poll the session until the outcome reaches a terminal state. Fits the
 * same start/poll contract as the batch adapters, so the existing polling
 * loop, recovery cron, and retry logic apply unchanged.
 */

type ManagedSession = Beta.Sessions.BetaManagedAgentsSession;

/** Outcome results that mean the report is ready to collect. */
const COMPLETED_OUTCOME_RESULTS = new Set([
  "satisfied",
  "max_iterations_reached",
]);

export const anthropicManagedAgentsAdapter: ResearchProviderAdapter = {
  providerId: "anthropic",
  harnessId: "anthropic-managed-agents",

  async start(model, prompt, apiKey) {
    const runtime = model.managedAgent;
    if (!runtime) {
      throw new Error(
        `Missing managedAgent runtime config for model ${model.id}`
      );
    }

    const client = new Anthropic({ apiKey });
    const { environmentId, coordinatorAgentId } =
      await ensureManagedAgentResources(client, model, runtime);

    const session = await client.beta.sessions.create({
      agent: coordinatorAgentId,
      environment_id: environmentId,
      title: `${model.label} research`,
      metadata: { app: "kenkyuu-research", model_id: model.id },
    });

    // The outcome event kicks the agent off — no separate user message. The
    // harness iterates produce → grade → revise against the rubric until
    // satisfied or the iteration cap is hit.
    await client.beta.sessions.events.send(session.id, {
      events: [
        {
          type: "user.define_outcome",
          description: prompt,
          rubric: { type: "text", content: RESEARCH_OUTCOME_RUBRIC },
          max_iterations: runtime.outcomeMaxIterations,
        },
      ],
    });

    return { externalId: session.id };
  },

  async poll(model, externalId, apiKey) {
    void model;
    const client = new Anthropic({ apiKey });
    const session = await client.beta.sessions.retrieve(externalId);

    switch (session.status) {
      case "running":
      case "rescheduling":
        return { status: "running" };
      case "terminated":
        return {
          status: "failed",
          error: "Managed agent session terminated before completing",
        };
      case "idle":
        return resolveIdleSession(client, session);
    }
  },
};

/**
 * An idle session is terminal for us only when its outcome evaluation is —
 * transient idles (e.g. between turns) keep polling until the hard timeout.
 */
async function resolveIdleSession(
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

/**
 * Extract the report and usage from a completed session. The coordinator's
 * system prompt requires its final message to be the complete report, so the
 * last agent.message on the primary thread is the deliverable.
 */
async function collectCompletedResult(
  client: Anthropic,
  session: ManagedSession
): Promise<PollResult> {
  let reportText: string | null = null;
  let toolCalls = 0;
  let webSearchRequests = 0;

  for await (const event of client.beta.sessions.events.list(session.id)) {
    switch (event.type) {
      case "agent.message": {
        const text = event.content
          .map((block) => block.text)
          .join("\n")
          .trim();
        if (text.length > 0) reportText = text;
        break;
      }
      case "agent.tool_use":
        toolCalls += 1;
        if (event.name === "web_search") webSearchRequests += 1;
        break;
      case "agent.mcp_tool_use":
        toolCalls += 1;
        break;
    }
  }

  if (!reportText) {
    return {
      status: "failed",
      error: "Session completed but produced no report message",
    };
  }

  return {
    status: "completed",
    text: reportText,
    usage: {
      inputTokens: session.usage.input_tokens ?? 0,
      outputTokens: session.usage.output_tokens ?? 0,
      webSearchRequests,
      // Tool calls only cover the coordinator's primary thread; subagent
      // thread activity is not itemized here.
      toolCalls,
      durationMs: (session.stats.active_seconds ?? 0) * 1000,
    },
  };
}
