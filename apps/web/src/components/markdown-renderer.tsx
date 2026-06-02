import { useState, useCallback, useMemo, type HTMLAttributes } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronsDown, ChevronsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Heading styles (Tailwind preflight resets h1–h6; we restore hierarchy) ---

const headingStyles: Record<number, string> = {
  1: "text-2xl font-bold tracking-tight text-foreground",
  2: "text-xl font-semibold tracking-tight text-foreground",
  3: "text-lg font-semibold text-foreground",
  4: "text-base font-semibold text-foreground",
  5: "text-sm font-semibold text-foreground",
  6: "text-sm font-medium text-muted-foreground",
};

/** Vertical rhythm for headings inside flowing markdown (not collapsible titles). */
const headingSpacing: Record<number, string> = {
  1: "mt-8 mb-4 scroll-mt-20 first:mt-0",
  2: "mt-8 mb-3 scroll-mt-20 first:mt-0",
  3: "mt-6 mb-2 scroll-mt-20",
  4: "mt-5 mb-2 scroll-mt-20",
  5: "mt-4 mb-2 scroll-mt-20",
  6: "mt-4 mb-2 scroll-mt-20",
};

/**
 * Builds a react-markdown heading element with explicit size/weight so
 * Tailwind preflight does not flatten headings to body text.
 */
function createHeadingComponent(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Tag = `h${level}` as const;
  return function MarkdownHeading({
    children,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <Tag
        className={cn(
          headingStyles[level],
          headingSpacing[level]
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  };
}

// --- Markdown components ---

const markdownComponents: Components = {
  h1: createHeadingComponent(1),
  h2: createHeadingComponent(2),
  h3: createHeadingComponent(3),
  h4: createHeadingComponent(4),
  h5: createHeadingComponent(5),
  h6: createHeadingComponent(6),
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
      className="bg-muted mb-3 max-w-full overflow-x-auto rounded-lg p-4 text-sm whitespace-pre-wrap break-words"
      {...props}
    >
      {children}
    </pre>
  ),
  img: ({ alt, src, ...props }) => (
    <img
      alt={alt ?? ""}
      src={src}
      className="mb-3 h-auto max-w-full rounded-md"
      {...props}
    />
  ),
  table: ({ children, ...props }) => (
    <div className="mb-3 max-w-full overflow-x-auto">
      <table className="w-max min-w-full border-collapse text-sm" {...props}>
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

/** Depth of a collapsible section key (`"0"` → 0, `"0.2.1"` → 2). */
function sectionKeyDepth(key: string): number {
  return key.split(".").length - 1;
}

/** All section keys at or above a given depth (inclusive). */
function openKeysUpToDepth(keys: string[], maxDepth: number): Set<string> {
  return new Set(keys.filter((key) => sectionKeyDepth(key) <= maxDepth));
}

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
        <span
          className={cn(
            headingStyles[section.displayLevel] ?? headingStyles[4]
          )}
        >
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={{ p: ({ children }) => <>{children}</> }}
          >
            {section.title}
          </ReactMarkdown>
        </span>
      </button>
      {isOpen && (
        <div className="min-w-0 max-w-full pb-3 pl-6">
          {section.content && (
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              components={markdownComponents}
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
  /**
   * Tailwind `top-*` offset for sticky outline controls (e.g. `top-14 md:top-0`
   * when a fixed mobile header sits above the scroll area).
   */
  outlineControlsStickyTopClassName?: string;
}

export function MarkdownRenderer({
  content,
  className,
  collapsible = true,
  outlineControlsStickyTopClassName = "top-0",
}: MarkdownRendererProps) {
  const fixedContent = useMemo(() => fixMarkdownTables(content), [content]);
  const { preamble, sections } = useMemo(
    () => parseSections(fixedContent),
    [fixedContent]
  );
  const hasCollapsibleSections = collapsible && sections.length > 0;

  // Collect all collapsible section keys from the tree
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

  const maxTreeDepth = useMemo(
    () =>
      allKeys.length === 0
        ? -1
        : Math.max(...allKeys.map(sectionKeyDepth)),
    [allKeys]
  );

  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(allKeys));

  const maxOpenDepth = useMemo(() => {
    if (openSet.size === 0) return -1;
    return Math.max(...[...openSet].map(sectionKeyDepth));
  }, [openSet]);

  const canExpandOneLevel = maxOpenDepth < maxTreeDepth;
  const canCollapseOneLevel = openSet.size > 0;

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

  const expandOneLevel = useCallback(() => {
    const targetDepth = maxOpenDepth + 1;
    if (targetDepth > maxTreeDepth) return;
    setOpenSet(openKeysUpToDepth(allKeys, targetDepth));
  }, [allKeys, maxOpenDepth, maxTreeDepth]);

  const collapseOneLevel = useCallback(() => {
    if (openSet.size === 0) return;
    const targetDepth = maxOpenDepth - 1;
    setOpenSet(
      targetDepth < 0 ? new Set() : openKeysUpToDepth(allKeys, targetDepth)
    );
  }, [allKeys, maxOpenDepth, openSet.size]);

  if (!hasCollapsibleSections) {
    return (
      <div
        className={cn(
          "text-foreground min-w-0 max-w-full text-sm leading-relaxed break-words",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          components={markdownComponents}
        >
          {fixedContent}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-foreground min-w-0 max-w-full text-sm leading-relaxed break-words",
        className
      )}
    >
      {/* Outline depth controls — sticky while scrolling long reports */}
      <div
        className={cn(
          "sticky z-20 -mx-1 mb-3 flex items-center justify-end gap-1 rounded-lg border border-border/60 bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80 dark:bg-background/90",
          outlineControlsStickyTopClassName
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={expandOneLevel}
          disabled={!canExpandOneLevel}
          title="Expand one more level of sections"
        >
          <ChevronsDown className="size-3.5" />
          Expand level
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={collapseOneLevel}
          disabled={!canCollapseOneLevel}
          title="Collapse one level of sections"
        >
          <ChevronsUp className="size-3.5" />
          Collapse level
        </Button>
      </div>

      {/* Preamble (content before any heading, or h1's content) */}
      {preamble && (
        <div className="mb-3">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
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
