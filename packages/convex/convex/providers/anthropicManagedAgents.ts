"use node";

import Anthropic from "@anthropic-ai/sdk";
import type { ResearchProviderAdapter } from "./types";
import { RESEARCH_OUTCOME_RUBRIC } from "@repo/research-models/managed-agent-prompt";
import { ensureManagedAgentResources } from "./managedAgentProvisioning/ensureManagedAgentResources";
import { resolveIdleSession } from "./anthropicManagedAgents/resolveIdleSession";

/**
 * Managed Agents harness adapter — Anthropic hosts the agent loop and a
 * per-session container; we create a session, send one rubric-graded outcome,
 * and poll the session until the outcome reaches a terminal state. Fits the
 * same start/poll contract as the batch adapters, so the existing polling
 * loop, recovery cron, and retry logic apply unchanged.
 */

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
