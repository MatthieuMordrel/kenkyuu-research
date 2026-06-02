import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCreatePrompt, useUpdatePrompt } from "@/hooks/use-prompts";
import {
  injectVariables,
  extractVariables,
  getPromptVariables,
} from "@/lib/prompt-preview";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVE_RESEARCH_MODELS,
  DEFAULT_MODEL_ID,
  resolvePromptModelId,
  type ResearchModelId,
} from "@/lib/research-flow";
import type { Doc } from "@repo/convex/dataModel";

type PromptType = "single-stock" | "multi-stock" | "discovery";

interface PromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: Doc<"prompts"> | null;
}

interface PromptFormData {
  name: string;
  description: string;
  type: PromptType;
  template: string;
  defaultModelId: ResearchModelId;
}

interface PromptFormErrors {
  name?: string;
  description?: string;
  template?: string;
}

const INITIAL_FORM: PromptFormData = {
  name: "",
  description: "",
  type: "single-stock",
  template: "",
  defaultModelId: DEFAULT_MODEL_ID,
};

const MODEL_OPTIONS = ACTIVE_RESEARCH_MODELS.map((model) => ({
  value: model.id,
  label: model.label,
  description: model.description,
}));

const TYPE_OPTIONS: {
  value: PromptType;
  label: string;
  description: string;
}[] = [
  {
    value: "single-stock",
    label: "Single Stock",
    description: "Analyzes one stock using {{TICKER}}",
  },
  {
    value: "multi-stock",
    label: "Multi Stock",
    description: "Analyzes multiple stocks using {{STOCKS}}",
  },
  {
    value: "discovery",
    label: "Discovery",
    description: "No stock input required",
  },
];

function validatePromptForm(form: PromptFormData): PromptFormErrors {
  const errors: PromptFormErrors = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (!form.description.trim()) errors.description = "Description is required";
  if (!form.template.trim()) errors.template = "Template is required";
  return errors;
}

function hasErrors(errors: PromptFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function PromptModal({ open, onOpenChange, prompt }: PromptModalProps) {
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const isEditing = !!prompt;

  const [form, setForm] = useState<PromptFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<PromptFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      if (prompt) {
        setForm({
          name: prompt.name,
          description: prompt.description,
          type: prompt.type,
          template: prompt.template,
          defaultModelId: resolvePromptModelId({
            defaultModelId: prompt.defaultModelId,
            defaultProvider: prompt.defaultProvider,
          }),
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
      setSubmitError(null);
      setShowPreview(false);
    }
  }, [open, prompt]);

  function updateField<K extends keyof PromptFormData>(
    field: K,
    value: PromptFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof PromptFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const previewText = useMemo(
    () => injectVariables(form.template),
    [form.template]
  );

  const usedVariables = useMemo(
    () => extractVariables(form.template),
    [form.template]
  );

  const availableVariables = getPromptVariables();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validationErrors = validatePromptForm(form);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    setSubmitting(true);
    try {
      if (isEditing && prompt) {
        await updatePrompt({
          id: prompt._id,
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          template: form.template,
          defaultModelId: form.defaultModelId,
        });
      } else {
        await createPrompt({
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          template: form.template,
          defaultModelId: form.defaultModelId,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Prompt" : "Create Prompt"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the prompt template below."
              : "Create a new research prompt template."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt-name">Name *</Label>
            <Input
              id="prompt-name"
              placeholder="e.g. Deep Dive Analysis"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt-description">Description *</Label>
            <Input
              id="prompt-description"
              placeholder="e.g. Comprehensive stock analysis covering fundamentals and technicals"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              aria-invalid={!!errors.description}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Type *</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("type", option.value)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors",
                    form.type === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Default Model</Label>
            <div
              className={cn(
                "grid gap-2",
                MODEL_OPTIONS.length > 1 ? "grid-cols-2" : "grid-cols-1"
              )}
            >
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("defaultModelId", option.value)}
                  className={cn(
                    "rounded-md border p-2 text-left text-sm transition-colors",
                    form.defaultModelId === option.value
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:bg-accent"
                  )}
                >
                  <span className="block">{option.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Used as the default for new research runs and schedules of this
              prompt.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Template *</Label>
              <div className="flex items-center rounded-md border bg-muted p-0.5">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className={cn(
                    "rounded px-2 py-1 text-xs transition-colors",
                    !showPreview
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
                    showPreview
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <Eye className="size-3" />
                  Preview
                </button>
              </div>
            </div>

            {showPreview ? (
              <div className="max-h-64 overflow-y-auto rounded-md border bg-muted/30 p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {previewText}
                </ReactMarkdown>
              </div>
            ) : (
              <Textarea
                placeholder="Enter your prompt template with {{TICKER}}, {{STOCKS}}, or {{DATE}} variables..."
                value={form.template}
                onChange={(e) => updateField("template", e.target.value)}
                rows={10}
                aria-invalid={!!errors.template}
                className="font-mono text-sm"
              />
            )}
            {errors.template && (
              <p className="text-xs text-destructive">{errors.template}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {availableVariables.map((v) => (
                <Badge
                  key={v.name}
                  variant={usedVariables.includes(v.name) ? "default" : "outline"}
                  className="text-[10px]"
                >
                  {`{{${v.name}}}`}
                </Badge>
              ))}
            </div>
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
