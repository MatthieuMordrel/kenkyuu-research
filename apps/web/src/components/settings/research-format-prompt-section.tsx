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

const formatPromptView = getResearchFormatPromptView();

interface PromptViewRowProps {
  /** Row title shown in the settings list */
  title: string;
  /** Short summary of when this prompt is used */
  description: string;
  /** Full prompt markdown opened in the modal */
  content: string;
  /** Optional modal description under the title */
  modalDescription?: string;
}

/**
 * Compact settings row with a modal trigger for a long prompt body.
 */
function PromptViewRow({
  title,
  description,
  content,
  modalDescription,
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
          {formatPromptView.completionDescription} One background response
          polishes the full raw report after research completes.
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

        <div className="flex flex-col gap-2">
          <PromptViewRow
            title="System prompt"
            description="Light markdown polish; the user message is only the report body."
            content={formatPromptView.systemPrompt}
          />
          <div className="rounded-lg border bg-muted/10 px-3 py-3">
            <p className="text-sm font-medium">User message</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatPromptView.userMessageDescription}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
