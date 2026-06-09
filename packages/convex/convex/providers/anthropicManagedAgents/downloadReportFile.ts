import type Anthropic from "@anthropic-ai/sdk";
import { pickReportFile } from "./pickReportFile";

/**
 * The Files API only understands session-scoped listing under this beta; the
 * SDK adds it for sessions routes but not for files routes, so it must be
 * passed explicitly here (the live API 400s on scope_id without it).
 */
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

/**
 * Fetch the report the agent wrote in its session container. Files created
 * there surface as session-scoped entries in the Files API. Returns null when
 * no report file exists (the caller falls back to message text).
 */
export async function downloadReportFile(
  client: Anthropic,
  sessionId: string
): Promise<string | null> {
  const files = [];
  for await (const file of client.beta.files.list({
    scope_id: sessionId,
    betas: [MANAGED_AGENTS_BETA],
  })) {
    files.push(file);
  }

  const reportFile = pickReportFile(files);
  if (!reportFile) return null;

  const response = await client.beta.files.download(reportFile.id, {
    betas: [MANAGED_AGENTS_BETA],
  });
  const text = (await response.text()).trim();
  return text.length > 0 ? text : null;
}
