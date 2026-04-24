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
import type { Doc } from "@repo/convex/dataModel";

type PromptType = "single-stock" | "multi-stock" | "discovery";
type ProviderName = "openai" | "anthropic";

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
  defaultProvider: ProviderName;
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
  defaultProvider: "openai",
};

const PROVIDER_OPTIONS: { value: ProviderName; label: string }[] = [
  { value: "openai", label: "OpenAI Deep Research" },
  { value: "anthropic", label: "Claude Opus 4.7" },
];

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
          defaultProvider: (prompt.defaultProvider ?? "openai") as ProviderName,
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
          defaultProvider: form.defaultProvider,
        });
      } else {
        await createPrompt({
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          template: form.template,
          defaultProvider: form.defaultProvider,
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
            <Label>Default Provider</Label>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField("defaultProvider", option.value)}
                  className={cn(
                    "rounded-md border p-2 text-left text-sm transition-colors",
                    form.defaultProvider === option.value
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {option.label}
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
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    !showPreview
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    showPreview
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="size-3" />
                  Preview
                </button>
              </div>
            </div>

            {/* Variable hints — only show in edit mode */}
            {!showPreview && (
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map((v) => (
                  <Badge
                    key={v.name}
                    variant={
                      usedVariables.includes(v.name) ? "default" : "outline"
                    }
                    className="text-[10px] px-1.5 py-0 cursor-help"
                    title={v.description}
                  >
                    {v.pattern}
                  </Badge>
                ))}
              </div>
            )}

            {showPreview ? (
              <div className="rounded-md border bg-muted/50 p-4 text-sm min-h-[12rem] max-h-[24rem] overflow-y-auto [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-2 [&_p]:leading-relaxed [&_ul]:mb-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:mb-2 [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:mb-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_pre]:mb-2 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_hr]:my-3 [&_hr]:border-border [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-muted [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5">
                {form.template.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {previewText}
                  </ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground italic">
                    Enter a template to see a preview
                  </span>
                )}
              </div>
            ) : (
              <>
                <Textarea
                  id="prompt-template"
                  placeholder="Write your prompt template here. Use {{TICKER}}, {{STOCKS}}, or {{DATE}} for variable injection."
                  value={form.template}
                  onChange={(e) => updateField("template", e.target.value)}
                  aria-invalid={!!errors.template}
                  rows={8}
                  className="font-mono text-sm"
                />
                {errors.template && (
                  <p className="text-xs text-destructive">{errors.template}</p>
                )}
              </>
            )}
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
              {submitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Prompt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
