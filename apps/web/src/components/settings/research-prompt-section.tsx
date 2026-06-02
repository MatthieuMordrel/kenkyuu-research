import { getResearchPromptView } from "@repo/research-models/research-prompt";
import { PromptPreviewDialog } from "@/components/prompt-preview-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, FileSearch } from "lucide-react";
import { Link } from "@tanstack/react-router";

const researchPromptView = getResearchPromptView();

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
 * Settings card documenting the first-pass research prompts (provider layer + templates).
 */
export function ResearchPromptSection() {
  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSearch className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Research (first pass)</CardTitle>
        </div>
        <CardDescription>
          When you run research, the model receives a prompt template you choose
          on the{" "}
          <Link to="/prompts" className="font-medium text-primary underline-offset-4 hover:underline">
            Prompts
          </Link>{" "}
          page. Some providers also attach fixed instructions before that
          template.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">By provider</p>
          <div className="flex flex-col gap-2">
            {researchPromptView.providers.map((provider) =>
              provider.systemInstructions ? (
                <PromptViewRow
                  key={provider.providerId}
                  title={`${provider.providerLabel} — provider instructions`}
                  description={provider.deliveryNote}
                  content={provider.systemInstructions}
                  modalDescription={`Fixed instructions sent on every ${provider.providerLabel} research job, before your prompt template.`}
                />
              ) : (
                <div
                  key={provider.providerId}
                  className="rounded-lg border bg-muted/10 px-3 py-3"
                >
                  <p className="text-sm font-medium">
                    {provider.providerLabel} — no system prompt
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {provider.deliveryNote}
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Built-in prompt template</p>
          <p className="text-xs text-muted-foreground">
            Each job uses the template from the prompt you select. Custom prompts
            are managed on the Prompts page; this is the default seeded template.
          </p>
          <PromptViewRow
            title={researchPromptView.builtInDiscoveryName}
            description={researchPromptView.builtInDiscoveryDescription}
            content={researchPromptView.builtInDiscoveryTemplate}
            modalDescription="Supports {{DATE}}, {{TICKER}}, and {{STOCKS}} placeholders, resolved when the job starts."
          />
        </div>
      </CardContent>
    </Card>
  );
}
