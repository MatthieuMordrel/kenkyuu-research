import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import { basename } from "./basename";

/** Whether a container file is a markdown document, by extension or mime type. */
export function isMarkdown(file: Beta.FileMetadata): boolean {
  return (
    basename(file.filename).endsWith(".md") ||
    file.mime_type.includes("markdown")
  );
}
