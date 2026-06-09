import {
  useState,
  useCallback,
  useMemo,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useStickyActive } from "@/hooks/use-sticky-active";
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
        className={cn(headingStyles[level], headingSpacing[level])}
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
      {/* Freeze the first column (usually a ticker/date) so it stays visible while scrolling wide tables sideways. */}
      <table
        className="w-max min-w-full border-collapse text-sm [&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:left-0 [&_tbody_td:first-child]:z-10 [&_tbody_td:first-child]:bg-card [&_tbody_td:first-child]:shadow-[1px_0_0_0_var(--color-border)] [&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:z-20 [&_thead_th:first-child]:bg-muted [&_thead_th:first-child]:shadow-[1px_0_0_0_var(--color-border)]"
        {...props}
      >
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

/** Renders section titles inline (no paragraph wrapper) inside collapsible headers. */
const titleMarkdownComponents: Components = {
  p: ({ children }) => <>{children}</>,
};

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
  /** Stable id derived from the title and its occurrence order at parse time. */
  id: string;
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

    // Only h1–h2 become collapsible outline nodes; h3+ stay in section body.
    const match = line.match(/^(#{1,2})\s+(.+)$/);
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
        id: "",
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

  const sections = flattenThinSections(buildTree(flat));
  assignSectionIds(sections, new Map());

  return {
    preamble: preamble.trim(),
    sections,
  };
}

/**
 * Assigns each section a stable id from its title and occurrence count so
 * React keys survive re-parses of the same markdown.
 */
function assignSectionIds(
  sections: Section[],
  occurrences: Map<string, number>
): void {
  for (const section of sections) {
    const count = (occurrences.get(section.title) ?? 0) + 1;
    occurrences.set(section.title, count);
    section.id = `${section.title}#${count}`;
    assignSectionIds(section.children, occurrences);
  }
}

/** Minimum body length (chars) for a ## section to be collapsible on its own. */
const MIN_COLLAPSIBLE_CHARS = 160;

/**
 * Returns true when a section has enough substance to be a collapsible group.
 */
function isSubstantialSection(section: Section): boolean {
  if (section.children.length > 0) {
    return (
      section.content.trim().length >= MIN_COLLAPSIBLE_CHARS ||
      section.children.some(isSubstantialSection)
    );
  }
  const lines = section.content.split("\n").filter((line) => line.trim());
  return (
    section.content.trim().length >= MIN_COLLAPSIBLE_CHARS && lines.length >= 2
  );
}

/**
 * Merges thin ## sections into the previous sibling as in-body ### headings.
 */
function flattenThinSections(sections: Section[]): Section[] {
  const result: Section[] = [];

  for (const section of sections) {
    const children = flattenThinSections(section.children);
    const node: Section = { ...section, children };

    if (!isSubstantialSection(node)) {
      const body = [
        node.content.trim(),
        ...children.map(
          (child) => `### ${child.title}\n\n${child.content.trim()}`
        ),
      ]
        .filter(Boolean)
        .join("\n\n");

      if (result.length > 0) {
        const prev = result[result.length - 1];
        prev.content = [prev.content.trim(), `### ${node.title}`, body]
          .filter(Boolean)
          .join("\n\n");
        continue;
      }

      result.push({
        ...node,
        content: body ? `### ${node.title}\n\n${body}` : `### ${node.title}`,
        children: [],
      });
      continue;
    }

    result.push(node);
  }

  return result;
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
            components={titleMarkdownComponents}
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
                  key={child.id}
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

// --- Outline depth controls ---

interface OutlineDepthControlsProps {
  /** Expands one additional heading level in the outline */
  onExpandOneLevel: () => void;
  /** Collapses one heading level in the outline */
  onCollapseOneLevel: () => void;
  /** Whether another level can be expanded */
  canExpandOneLevel: boolean;
  /** Whether another level can be collapsed */
  canCollapseOneLevel: boolean;
}

/** Builds the outline controls element outside of JSX attribute position. */
function renderOutlineControls(props: OutlineDepthControlsProps) {
  return <OutlineDepthControls {...props} />;
}

/**
 * Expand/collapse buttons for hierarchical markdown section outlines.
 */
function OutlineDepthControls({
  onExpandOneLevel,
  onCollapseOneLevel,
  canExpandOneLevel,
  canCollapseOneLevel,
}: OutlineDepthControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        onClick={onExpandOneLevel}
        disabled={!canExpandOneLevel}
        title="Expand one more level of sections"
      >
        <ChevronsDown className="size-3.5" />
        <span className="hidden sm:inline">Expand level</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground"
        onClick={onCollapseOneLevel}
        disabled={!canCollapseOneLevel}
        title="Collapse one level of sections"
      >
        <ChevronsUp className="size-3.5" />
        <span className="hidden sm:inline">Collapse level</span>
      </Button>
    </div>
  );
}

interface MarkdownRendererHeaderProps {
  /** Title shown on the left side of the header row */
  title: string;
  /** Optional icon rendered before the title */
  icon?: ComponentType<{ className?: string }>;
  /** Extra controls rendered before outline controls on the right (e.g. view toggles). */
  headerTrailing?: ReactNode;
  /** Outline controls rendered on the right; omitted when sections are not collapsible */
  outlineControls?: ReactNode;
  /** Tailwind `top-*` offset when the header is sticky */
  stickyTopClassName?: string;
  /** Whether the header should stick while scrolling */
  sticky?: boolean;
}

/**
 * Sticky card-style header with a title on the left and optional outline controls on the right.
 * Uses a sentinel + intersection observer to deepen shadow and border when stuck while scrolling.
 */
function MarkdownRendererHeader({
  title,
  icon: Icon,
  headerTrailing,
  outlineControls,
  stickyTopClassName = "top-0",
  sticky = true,
}: MarkdownRendererHeaderProps) {
  const { sentinelRef, isStuck } = useStickyActive(sticky);

  return (
    <>
      {sticky ? (
        <div
          ref={sentinelRef}
          className="pointer-events-none h-px"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-t-xl border-b border-border/60 bg-background/95 px-6 py-3.5 transition-[box-shadow,border-color,background-color] duration-200 ease-out backdrop-blur-md supports-[backdrop-filter]:bg-background/80 dark:bg-background/90",
          sticky && cn("sticky z-20", stickyTopClassName),
          isStuck
            ? "border-border bg-background/98 shadow-md dark:bg-background/95"
            : "shadow-sm"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          ) : null}
          <span className="truncate text-base font-semibold leading-none tracking-tight">
            {title}
          </span>
        </div>
        {headerTrailing || outlineControls ? (
          <div className="flex shrink-0 items-center gap-2">
            {headerTrailing}
            {outlineControls}
          </div>
        ) : null}
      </div>
    </>
  );
}

// --- Main component ---

interface MarkdownRendererProps {
  content: string;
  className?: string;
  collapsible?: boolean;
  /**
   * Optional title for a header row at the top of the renderer. When set, outline
   * controls (if any) appear on the same row as the title.
   */
  headerTitle?: string;
  /** Optional icon shown before {@link MarkdownRendererProps.headerTitle}. */
  headerIcon?: ComponentType<{ className?: string }>;
  /**
   * Tailwind `top-*` offset for the sticky header (e.g. `top-14 md:top-0`
   * when a fixed mobile header sits above the scroll area).
   */
  outlineControlsStickyTopClassName?: string;
  /**
   * When true (default), the title header sticks while scrolling. Set to false to
   * keep the header in normal document flow.
   */
  headerSticky?: boolean;
  /** Optional controls in the header row before outline expand/collapse buttons. */
  headerTrailing?: ReactNode;
}

export function MarkdownRenderer({
  content,
  className,
  collapsible = true,
  headerTitle,
  headerIcon,
  outlineControlsStickyTopClassName = "top-0",
  headerSticky = true,
  headerTrailing,
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
      allKeys.length === 0 ? -1 : Math.max(...allKeys.map(sectionKeyDepth)),
    [allKeys]
  );

  /** All sections collapsed by default; readers expand what they need. */
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set());

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

  const outlineControls = hasCollapsibleSections
    ? renderOutlineControls({
        onExpandOneLevel: expandOneLevel,
        onCollapseOneLevel: collapseOneLevel,
        canExpandOneLevel,
        canCollapseOneLevel,
      })
    : undefined;

  const shouldStickHeader = headerSticky && !!headerTitle;

  const header = headerTitle ? (
    <MarkdownRendererHeader
      title={headerTitle}
      icon={headerIcon}
      headerTrailing={headerTrailing}
      outlineControls={outlineControls}
      stickyTopClassName={outlineControlsStickyTopClassName}
      sticky={shouldStickHeader}
    />
  ) : hasCollapsibleSections ? (
    <div
      className={cn(
        "sticky z-20 -mx-1 mb-3 flex items-center justify-end gap-1 rounded-lg border border-border/60 bg-background/95 px-2 py-1.5 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80 dark:bg-background/90",
        outlineControlsStickyTopClassName
      )}
    >
      {outlineControls}
    </div>
  ) : null;

  const contentClassName = cn(
    "text-foreground min-w-0 max-w-full text-sm leading-relaxed break-words",
    headerTitle && "px-6 pb-6 pt-4",
    className
  );

  if (!hasCollapsibleSections) {
    return (
      <div className="min-w-0 max-w-full">
        {header}
        <div className={contentClassName}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {fixedContent}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      {header}

      <div className={contentClassName}>
        {/* Preamble (content before any heading, or h1's content) */}
        {preamble ? (
          <div className="mb-3">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              components={markdownComponents}
            >
              {preamble}
            </ReactMarkdown>
          </div>
        ) : null}

        {/* Collapsible sections (hierarchical) */}
        <div className="flex flex-col">
          {sections.map((section, i) => (
            <CollapsibleSection
              key={section.id}
              section={section}
              openSet={openSet}
              pathKey={`${i}`}
              onToggle={toggleSection}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
