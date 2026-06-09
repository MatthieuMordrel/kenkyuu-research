import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import { MANAGED_AGENT_REPORT_PATH } from "@repo/research-models/managed-agent-prompt";

import { basename } from "./basename";
import { isMarkdown } from "./isMarkdown";

const REPORT_BASENAME = MANAGED_AGENT_REPORT_PATH.split("/").at(-1) ?? "";

/**
 * Choose the report among a session's container files. The prompt and rubric
 * pin the deliverable to MANAGED_AGENT_REPORT_PATH, so an exact basename match
 * wins; if the agent strayed, fall back to the newest markdown file rather
 * than losing the report entirely.
 */
export function pickReportFile(
  files: Beta.FileMetadata[]
): Beta.FileMetadata | null {
  const candidates = files.filter((file) => file.downloadable !== false);

  const exact = candidates.find(
    (file) => basename(file.filename) === REPORT_BASENAME
  );
  if (exact) return exact;

  const markdown = candidates
    .filter(isMarkdown)
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
  return markdown[0] ?? null;
}
