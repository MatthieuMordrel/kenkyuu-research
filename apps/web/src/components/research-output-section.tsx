import { useEffect, useRef, useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileText, FlaskConical, Sparkles } from "lucide-react";
import type { Doc } from "@repo/convex/dataModel";

/** Which research report variant is shown in the markdown viewer. */
export type ResearchOutputView = "formatted" | "raw";

interface ResearchOutputSectionProps {
  /** Research job whose output fields drive the viewer. */
  job: Pick<Doc<"researchJobs">, "rawResult" | "result" | "status">;
}

/**
 * Resolves which markdown bodies are available and whether the user can switch views.
 */
function resolveResearchOutput(job: ResearchOutputSectionProps["job"]): {
  formatted: string | null;
  raw: string | null;
  canToggle: boolean;
  displayContent: string | null;
  defaultView: ResearchOutputView;
} {
  const formatted = job.result?.trim() ? job.result : null;
  const raw = job.rawResult?.trim() ? job.rawResult : null;
  const canToggle = Boolean(formatted && raw);
  const defaultView: ResearchOutputView = formatted ? "formatted" : "raw";
  const isFormatting = job.status === "formatting";

  let displayContent: string | null = null;
  if (isFormatting && raw) {
    displayContent = raw;
  } else if (formatted) {
    displayContent = formatted;
  } else if (raw) {
    displayContent = raw;
  }

  return { formatted, raw, canToggle, displayContent, defaultView };
}

/**
 * Pill toggle to switch between formatted and raw research output when both exist.
 */
function ResearchOutputViewToggle({
  view,
  onViewChange,
}: {
  view: ResearchOutputView;
  onViewChange: (view: ResearchOutputView) => void;
}) {
  const options: {
    value: ResearchOutputView;
    label: string;
    icon: typeof Sparkles;
  }[] = [
    { value: "formatted", label: "Formatted", icon: Sparkles },
    { value: "raw", label: "Raw", icon: FileText },
  ];

  return (
    <div
      className="flex shrink-0 gap-1 rounded-lg border border-border/60 bg-muted/30 p-0.5"
      role="group"
      aria-label="Research output view"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onViewChange(option.value)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const formattingBadge = (
  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
    Formatting…
  </span>
);

/** Builds the header-trailing element for the markdown viewer outside of JSX attribute position. */
function renderViewToggle(
  view: ResearchOutputView,
  onViewChange: (view: ResearchOutputView) => void
) {
  return <ResearchOutputViewToggle view={view} onViewChange={onViewChange} />;
}

/**
 * Renders research job output with an optional raw vs formatted toggle in the markdown header.
 */
export function ResearchOutputSection({ job }: ResearchOutputSectionProps) {
  const { formatted, raw, canToggle, displayContent, defaultView } =
    resolveResearchOutput(job);
  const [view, setView] = useState<ResearchOutputView>(defaultView);
  const hadToggleRef = useRef(canToggle);

  /** After formatting finishes, default to the polished report unless the user already chose a view. */
  useEffect(() => {
    if (!hadToggleRef.current && canToggle) {
      setView("formatted");
    }
    hadToggleRef.current = canToggle;
  }, [canToggle]);

  if (!displayContent) {
    return null;
  }

  const activeView = canToggle ? view : defaultView;
  const content =
    canToggle && activeView === "raw" && raw
      ? raw
      : (formatted ?? raw ?? displayContent);

  const headerTitle =
    activeView === "raw" ? "Research Output (raw)" : "Research Output";

  const isFormatting = job.status === "formatting";

  return (
    <Card className="min-w-0 gap-0 py-0">
      <MarkdownRenderer
        key={activeView}
        content={content}
        headerTitle={headerTitle}
        headerIcon={FlaskConical}
        headerTrailing={
          canToggle
            ? renderViewToggle(activeView, setView)
            : isFormatting
              ? formattingBadge
              : undefined
        }
        outlineControlsStickyTopClassName="top-14 md:top-0"
        className="overflow-x-auto"
      />
    </Card>
  );
}
