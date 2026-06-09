import type Anthropic from "@anthropic-ai/sdk";
import { pickReportFile } from "./pickReportFile";

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
  for await (const file of client.beta.files.list({ scope_id: sessionId })) {
    files.push(file);
  }

  const reportFile = pickReportFile(files);
  if (!reportFile) return null;

  const response = await client.beta.files.download(reportFile.id);
  const text = (await response.text()).trim();
  return text.length > 0 ? text : null;
}
