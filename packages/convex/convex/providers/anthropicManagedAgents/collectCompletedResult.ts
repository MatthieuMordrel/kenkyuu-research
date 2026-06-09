import type Anthropic from "@anthropic-ai/sdk";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import type { PollResult } from "../types";
import { downloadReportFile } from "./downloadReportFile";

type ManagedSession = Beta.Sessions.BetaManagedAgentsSession;

/**
 * Extract the report and usage from a completed session. The coordinator's
 * system prompt and the outcome rubric pin the deliverable to a report file in
 * the session container, so that file is the primary source. The longest
 * agent.message on the primary thread is the fallback — longest rather than
 * last, because the message after grading is typically a wrap-up note, not
 * the report.
 */
export async function collectCompletedResult(
  client: Anthropic,
  session: ManagedSession
): Promise<PollResult> {
  let longestMessageText = "";
  let toolCalls = 0;
  let webSearchRequests = 0;

  for await (const event of client.beta.sessions.events.list(session.id)) {
    switch (event.type) {
      case "agent.message": {
        const text = event.content
          .map((block) => block.text)
          .join("\n")
          .trim();
        if (text.length > longestMessageText.length) longestMessageText = text;
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

  const reportText =
    (await downloadReportFile(client, session.id)) ||
    (longestMessageText.length > 0 ? longestMessageText : null);

  if (!reportText) {
    return {
      status: "failed",
      error:
        "Session completed but produced neither a report file nor a report message",
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
