import { describe, expect, it } from "vitest";
import type { Beta } from "@anthropic-ai/sdk/resources/beta";
import { pickReportFile } from "../providers/anthropicManagedAgents/pickReportFile";

function file(overrides: Partial<Beta.FileMetadata>): Beta.FileMetadata {
  return {
    id: "file_1",
    created_at: "2026-06-10T00:00:00Z",
    filename: "report.md",
    mime_type: "text/markdown",
    size_bytes: 1024,
    type: "file",
    ...overrides,
  };
}

describe("pickReportFile", () => {
  it("returns null when the session has no files", () => {
    expect(pickReportFile([])).toBeNull();
  });

  it("prefers the pinned report basename over other markdown files", () => {
    const pinned = file({ id: "file_pinned", filename: "report.md" });
    const stray = file({
      id: "file_stray",
      filename: "APH_deep_research_report.md",
      created_at: "2026-06-10T01:00:00Z",
    });
    expect(pickReportFile([stray, pinned])).toBe(pinned);
  });

  it("matches the pinned basename when the filename includes a path", () => {
    const pinned = file({
      id: "file_pinned",
      filename: "/mnt/session/outputs/report.md",
    });
    expect(pickReportFile([pinned])).toBe(pinned);
  });

  it("falls back to the newest markdown file when the pinned name is absent", () => {
    const older = file({
      id: "file_older",
      filename: "notes.md",
      created_at: "2026-06-10T00:00:00Z",
    });
    const newer = file({
      id: "file_newer",
      filename: "APH_deep_research_report.md",
      created_at: "2026-06-10T01:00:00Z",
    });
    expect(pickReportFile([older, newer])).toBe(newer);
  });

  it("recognizes markdown by mime type when the extension is missing", () => {
    const mimeOnly = file({
      id: "file_mime",
      filename: "report",
      mime_type: "text/markdown; charset=utf-8",
    });
    expect(pickReportFile([mimeOnly])).toBe(mimeOnly);
  });

  it("ignores non-markdown and non-downloadable files", () => {
    const csv = file({
      id: "file_csv",
      filename: "data.csv",
      mime_type: "text/csv",
    });
    const locked = file({ id: "file_locked", downloadable: false });
    expect(pickReportFile([csv, locked])).toBeNull();
  });
});
