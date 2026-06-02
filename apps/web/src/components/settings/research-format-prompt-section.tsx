import { getResearchFormatPromptView } from "@repo/research-models/format-prompt";
import { PromptPreviewDialog } from "@/components/prompt-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const formatPromptView = getResearchFormatPromptView();

/**
 * Explains the runtime appendix appended to formatter user messages.
 */
function UserMessageRuntimeAppendix() {
  return (
    <div className="mt-6 border-t border-dashed pt-4">
      <p className="text-xs font-medium text-muted-foreground">
        Appended at runtime
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The preprocessed research markdown is inserted below a separator for
        each formatting request.
      </p>
      <div className="mt-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
        {"{preprocessed research markdown}"}
      </div>
    </div>
  );
}

interface PromptViewRowProps {
  /** Row title shown in the settings list */
  title: string;
  /** Short summary of when this prompt is used */
  description: string;
  /** Full prompt markdown opened in the modal */
  content: string;
  /** Optional modal description under the title */
  modalDescription?: string;
  /** Optional content below the markdown in the modal */
  modalFooter?: ReactNode;
}

/**
 * Compact settings row with a modal trigger for a long prompt body.
 */
function PromptViewRow({
  title,
  description,
  content,
  modalDescription,
  modalFooter,
}: PromptViewRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/10 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <PromptPreviewDialog
        content={content}
        label={title}
        description={modalDescription ?? description}
        footer={modalFooter}
        trigger={(open) => (
          <Button
            variant="outline"
            size="sm"
            onClick={open}
            className="shrink-0 gap-1.5"
          >
            <Eye className="size-3.5" />
            View
          </Button>
        )}
      />
    </div>
  );
}

interface PromptGroupProps {
  /** Section heading */
  title: string;
  /** Optional helper text under the heading */
  description?: string;
  /** Prompt rows in this group */
  children: ReactNode;
}

/**
 * Groups related prompt rows with a shared heading.
 */
function PromptGroup({ title, description, children }: PromptGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Settings card showing the post-research formatting model and prompts.
 * Values are derived from the shared research-models registry.
 */
export function ResearchFormatPromptSection() {
  const modelRows = [
    { label: "Model", value: formatPromptView.modelLabel },
    { label: "API model", value: formatPromptView.apiModel },
    { label: "Provider", value: formatPromptView.providerLabel },
    { label: "Temperature", value: String(formatPromptView.temperature) },
  ];

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Research formatting</CardTitle>
        </div>
        <CardDescription>
          After research completes, this prompt and model polish the raw report
          before it is saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Active formatter
          </p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            {modelRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 text-xs">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <PromptGroup title="Standard reports">
          <PromptViewRow
            title="System prompt"
            description="Outline, readability, and fidelity rules sent as the system message."
            content={formatPromptView.systemPrompt}
          />
          <PromptViewRow
            title="User message"
            description="Instructions prepended before the research markdown in each request."
            content={formatPromptView.userMessageInstructions}
            modalFooter={<UserMessageRuntimeAppendix />}
          />
        </PromptGroup>

        <PromptGroup
          title="Long reports"
          description="Very long reports are split into chunks so each pass stays within time limits."
        >
          <PromptViewRow
            title="Fragment system prompt"
            description="Extra system rules when formatting one chunk of a longer report."
            content={formatPromptView.fragmentSystemPrompt}
          />
          <PromptViewRow
            title="First chunk user message"
            description="Used for the opening chunk of a multi-part report."
            content={formatPromptView.fragmentFirstUserInstructions}
            modalFooter={<UserMessageRuntimeAppendix />}
          />
          <PromptViewRow
            title="Middle / last chunk user message"
            description="Used for subsequent chunks so the formatter does not add new sections."
            content={formatPromptView.fragmentMiddleUserInstructions}
            modalFooter={<UserMessageRuntimeAppendix />}
          />
        </PromptGroup>
      </CardContent>
    </Card>
  );
}
