import type { Response } from "openai/resources/responses/responses";
import { renderOutputTextWithCitations } from "./renderOutputTextWithCitations";

/**
 * Extracts the final research report from a completed response while
 * preserving citation metadata exposed by the Responses API.
 */
export function renderResearchMarkdown(response: Response): string {
  const markdownParts: string[] = [];

  for (const outputItem of response.output) {
    if (outputItem.type !== "message") {
      continue;
    }

    for (const contentPart of outputItem.content) {
      if (contentPart.type === "output_text") {
        markdownParts.push(renderOutputTextWithCitations(contentPart));
      }
    }
  }

  if (markdownParts.length > 0) {
    return markdownParts.join("\n\n").trim();
  }

  return response.output_text.trim();
}
