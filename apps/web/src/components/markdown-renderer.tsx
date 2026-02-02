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
      className="bg-muted mb-3 overflow-x-auto rounded-lg p-4 text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  table: ({ children, ...props }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
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
      className="border-border border px-3 py-2 text-left font-semibold"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-border border px-3 py-2" {...props}>
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

// --- Section parsing ---

interface Section {
  level: number;
  title: string;
  content: string;
}

function parseSections(markdown: string): { preamble: string; sections: Section[] } {
  const lines = markdown.split("\n");
  let preamble = "";
  const sections: Section[] = [];
  let current: Section | null = null;
  const contentLines: string[] = [];

  function flushContent() {
    if (current) {
      current.content = contentLines.join("\n").trim();
      sections.push(current);
      contentLines.length = 0;
    }
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      flushContent();
      current = { level: match[1].length, title: match[2], content: "" };
    } else if (current) {
      contentLines.push(line);
    } else {
      preamble += line + "\n";
    }
  }
  flushContent();

  return { preamble: preamble.trim(), sections };
}

// --- Heading styles ---

const headingStyles: Record<number, string> = {
  1: "text-2xl font-bold tracking-tight",
  2: "text-xl font-semibold tracking-tight",
  3: "text-lg font-semibold",
  4: "text-base font-semibold",
};

// --- Collapsible section ---

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-border/50 border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 py-2 text-left hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-90",
          )}
        />
        <span className={cn(headingStyles[section.level])}>
          {section.title}
        </span>
      </button>
      {isOpen && section.content && (
        <div className="pb-3 pl-6">
          <ReactMarkdown remarkPlugins={remarkPlugins} components={baseComponents}>
            {section.content}
          </ReactMarkdown>
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
  const { preamble, sections } = useMemo(() => parseSections(content), [content]);
  const hasCollapsibleSections = collapsible && sections.length > 0;

  const [openSet, setOpenSet] = useState<Set<number>>(() => {
    return new Set(sections.map((_, i) => i));
  });

  const allExpanded = openSet.size === sections.length;

  const toggleSection = useCallback((index: number) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setOpenSet(new Set());
  }, []);

  const expandAll = useCallback(() => {
    setOpenSet(new Set(sections.map((_, i) => i)));
  }, [sections]);

  if (!hasCollapsibleSections) {
    return (
      <div className={cn("text-foreground text-sm leading-relaxed break-words overflow-hidden", className)}>
        <ReactMarkdown remarkPlugins={remarkPlugins} components={baseComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={cn("text-foreground text-sm leading-relaxed break-words overflow-hidden", className)}>
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

      {/* Preamble (content before any heading) */}
      {preamble && (
        <div className="mb-3">
          <ReactMarkdown remarkPlugins={remarkPlugins} components={baseComponents}>
            {preamble}
          </ReactMarkdown>
        </div>
      )}

      {/* Collapsible sections */}
      <div className="flex flex-col">
        {sections.map((section, i) => (
          <CollapsibleSection
            key={i}
            section={section}
            isOpen={openSet.has(i)}
            onToggle={() => toggleSection(i)}
          />
        ))}
      </div>
    </div>
  );
}
