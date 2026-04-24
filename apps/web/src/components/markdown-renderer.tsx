import { useState, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Markdown components (non-heading) ---

const baseComponents: Components = {
  p: ({ children, ...props }) => (
    <p className="mb-3 leading-7" {...props}>
      {children}
    </p>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary/80"
      {...props}
    >
      {children}
    </a>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-3 ml-6 list-disc space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-3 ml-6 list-decimal space-y-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-muted-foreground/30 mb-3 border-l-4 pl-4 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className="font-mono text-sm" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre
      className="bg-muted mb-3 overflow-x-auto rounded-lg p-4 text-sm whitespace-pre-wrap break-words"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="border-collapse text-sm w-max min-w-full" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-muted/50" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border-border border px-3 py-2 text-left font-semibold whitespace-nowrap"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-border border px-3 py-2 break-words" {...props}>
      {children}
    </td>
  ),
  hr: (props) => <hr className="border-border my-6" {...props} />,
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
};

const remarkPlugins = [remarkGfm];

// --- Fix malformed markdown tables ---
// AI models (especially OpenAI deep research) sometimes output tables with
// mismatched column counts between the header, separator, and data rows.
// Markdown parsers silently fail and render these as plain text.
// This function detects table blocks and repairs them.

function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;
  let inFence = false;

  while (i < lines.length) {
    if (isFenceDelimiter(lines[i])) {
      inFence = !inFence;
      result.push(lines[i]);
      i++;
      continue;
    }

    // Detect start of a potential table: a line with at least two pipe characters
    if (!inFence && isPipeRow(lines[i])) {
      // Collect the full table block (consecutive pipe rows)
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        !isFenceDelimiter(lines[i]) &&
        isPipeRow(lines[i])
      ) {
        tableLines.push(lines[i]);
        i++;
      }

      // A valid table needs at least 2 rows (header + separator).
      // Try to find and fix the separator row.
      if (tableLines.length >= 2) {
        const repaired = repairTable(tableLines);
        result.push(...repaired);
      } else {
        result.push(...tableLines);
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }

  return result.join("\n");
}

function isFenceDelimiter(line: string): boolean {
  return /^(```|~~~)/.test(line.trim());
}

function isPipeRow(line: string): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
}

function splitPipeCells(line: string): string[] {
  const trimmed = line.trim();
  // Remove leading and trailing pipes, then split
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|");
}

function isSeparatorRow(line: string): boolean {
  const cells = splitPipeCells(line);
  return cells.every((c) => /^\s*:?-+:?\s*$/.test(c.trim()));
}

function repairTable(tableLines: string[]): string[] {
  // Find the separator row (usually row index 1, but be flexible)
  let sepIndex = -1;
  for (let j = 0; j < Math.min(3, tableLines.length); j++) {
    if (isSeparatorRow(tableLines[j])) {
      sepIndex = j;
      break;
    }
  }

  // No separator found — not a real table, return as-is
  if (sepIndex === -1) return tableLines;

  // The header is the row just before the separator
  const headerIndex = sepIndex > 0 ? sepIndex - 1 : 0;
  const headerCols = splitPipeCells(tableLines[headerIndex]).length;

  // Find the max column count across all rows (in case header is short too)
  let maxCols = headerCols;
  for (const line of tableLines) {
    if (!isSeparatorRow(line)) {
      maxCols = Math.max(maxCols, splitPipeCells(line).length);
    }
  }

  // Repair each row to match maxCols
  return tableLines.map((line) => {
    const cells = splitPipeCells(line);
    const isSep = isSeparatorRow(line);

    if (cells.length === maxCols) return line;

    // Pad missing columns
    while (cells.length < maxCols) {
      cells.push(isSep ? "---" : "");
    }
    // Trim excess columns (less common, but possible)
    if (cells.length > maxCols) {
      cells.length = maxCols;
    }

    return "| " + cells.map((c) => c.trim()).join(" | ") + " |";
  });
}

// --- Section parsing (hierarchical) ---

interface Section {
  level: number;
  displayLevel: number;
  title: string;
  content: string;
  children: Section[];
}

interface ParsedMarkdown {
  preamble: string;
  sections: Section[];
}

function parseSections(markdown: string): ParsedMarkdown {
  const lines = markdown.split("\n");
  let preamble = "";
  let inFence = false;

  // First pass: collect flat sections
  interface FlatSection {
    level: number;
    displayLevel: number;
    title: string;
    contentLines: string[];
  }
  const flat: FlatSection[] = [];
  let current: FlatSection | null = null;

  for (const line of lines) {
    if (isFenceDelimiter(line)) {
      inFence = !inFence;
      if (current) {
        current.contentLines.push(line);
      } else {
        preamble += line + "\n";
      }
      continue;
    }

    if (inFence) {
      if (current) {
        current.contentLines.push(line);
      } else {
        preamble += line + "\n";
      }
      continue;
    }

    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      if (current) flat.push(current);
      const lvl = match[1].length;
      current = {
        level: lvl,
        displayLevel: lvl,
        title: match[2],
        contentLines: [],
      };
    } else if (current) {
      current.contentLines.push(line);
    } else {
      preamble += line + "\n";
    }
  }
  if (current) flat.push(current);

  // Treat the first h1 like an h2 for tree-building (so it's collapsible)
  // but keep its original display level for styling
  const firstIsH1 = flat.length > 0 && flat[0].level === 1;
  if (firstIsH1) {
    flat[0].level = 2;
  }

  // Build tree: nest sections by heading level
  function buildTree(items: FlatSection[]): Section[] {
    const result: Section[] = [];
    let i = 0;

    while (i < items.length) {
      const item = items[i];
      const section: Section = {
        level: item.level,
        displayLevel: item.displayLevel,
        title: item.title,
        content: item.contentLines.join("\n").trim(),
        children: [],
      };

      // Collect all following sections with a deeper level as children
      i++;
      const childItems: FlatSection[] = [];
      while (i < items.length && items[i].level > item.level) {
        childItems.push(items[i]);
        i++;
      }
      if (childItems.length > 0) {
        section.children = buildTree(childItems);
      }

      result.push(section);
    }

    return result;
  }

  return { preamble: preamble.trim(), sections: buildTree(flat) };
}

// --- Heading styles ---

const headingStyles: Record<number, string> = {
  1: "text-2xl font-bold tracking-tight",
  2: "text-xl font-semibold tracking-tight",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
};

// --- Collapsible section (recursive) ---

function CollapsibleSection({
  section,
  openSet,
  pathKey,
  onToggle,
}: {
  section: Section;
  openSet: Set<string>;
  pathKey: string;
  onToggle: (key: string) => void;
}) {
  const isOpen = openSet.has(pathKey);

  return (
    <div className="border-border/50 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(pathKey)}
        className="flex w-full items-center gap-2 py-2 text-left hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        <span className={cn(headingStyles[section.displayLevel])}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={{ p: ({ children }) => <>{children}</> }}
          >
            {section.title}
          </ReactMarkdown>
        </span>
      </button>
      {isOpen && (
        <div className="pb-3 pl-6 min-w-0 overflow-hidden">
          {section.content && (
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              components={baseComponents}
            >
              {section.content}
            </ReactMarkdown>
          )}
          {section.children.length > 0 && (
            <div className="flex flex-col">
              {section.children.map((child, i) => (
                <CollapsibleSection
                  key={i}
                  section={child}
                  openSet={openSet}
                  pathKey={`${pathKey}.${i}`}
                  onToggle={onToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main component ---

interface MarkdownRendererProps {
  content: string;
  className?: string;
  collapsible?: boolean;
}

export function MarkdownRenderer({
  content,
  className,
  collapsible = true,
}: MarkdownRendererProps) {
  const fixedContent = useMemo(() => fixMarkdownTables(content), [content]);
  const { preamble, sections } = useMemo(
    () => parseSections(fixedContent),
    [fixedContent]
  );
  const hasCollapsibleSections = collapsible && sections.length > 0;

  // Collect all keys from the tree for expand-all
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    function collect(items: Section[], prefix: string) {
      items.forEach((s, i) => {
        const key = `${prefix}${i}`;
        keys.push(key);
        collect(s.children, `${key}.`);
      });
    }
    collect(sections, "");
    return keys;
  }, [sections]);

  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(allKeys));

  const allExpanded = openSet.size === allKeys.length;

  const toggleSection = useCallback((key: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpenSet(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setOpenSet(new Set(allKeys));
  }, [allKeys]);

  if (!hasCollapsibleSections) {
    return (
      <div
        className={cn(
          "text-foreground text-sm leading-relaxed break-words overflow-hidden min-w-0",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          components={baseComponents}
        >
          {fixedContent}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-foreground text-sm leading-relaxed break-words overflow-hidden",
        className
      )}
    >
      {/* Collapse / Expand controls */}
      <div className="flex items-center justify-end gap-1 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={allExpanded ? collapseAll : expandAll}
        >
          {allExpanded ? (
            <>
              <ChevronsDownUp className="size-3.5" />
              Collapse all
            </>
          ) : (
            <>
              <ChevronsUpDown className="size-3.5" />
              Expand all
            </>
          )}
        </Button>
      </div>

      {/* Preamble (content before any heading, or h1's content) */}
      {preamble && (
        <div className="mb-3">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={baseComponents}
          >
            {preamble}
          </ReactMarkdown>
        </div>
      )}

      {/* Collapsible sections (hierarchical) */}
      <div className="flex flex-col">
        {sections.map((section, i) => (
          <CollapsibleSection
            key={i}
            section={section}
            openSet={openSet}
            pathKey={`${i}`}
            onToggle={toggleSection}
          />
        ))}
      </div>
    </div>
  );
}
