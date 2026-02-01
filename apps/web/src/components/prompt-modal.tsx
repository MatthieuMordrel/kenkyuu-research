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
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
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
};

const TYPE_OPTIONS: { value: PromptType; label: string; description: string }[] = [
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
    value: PromptFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof PromptFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const previewText = useMemo(
    () => injectVariables(form.template),
    [form.template],
  );

  const usedVariables = useMemo(
    () => extractVariables(form.template),
    [form.template],
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
        });
      } else {
        await createPrompt({
          name: form.name.trim(),
          description: form.description.trim(),
          type: form.type,
          template: form.template,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An error occurred",
      );
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
                      : "border-border hover:bg-accent",
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
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt-template">Template *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="h-auto py-1 text-xs"
              >
                {showPreview ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>

            {/* Variable hints */}
            <div className="flex flex-wrap gap-1.5">
              {availableVariables.map((v) => (
                <Badge
                  key={v.name}
                  variant={usedVariables.includes(v.name) ? "default" : "outline"}
                  className="text-[10px] px-1.5 py-0 cursor-help"
                  title={v.description}
                >
                  {v.pattern}
                </Badge>
              ))}
            </div>

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

            {/* Live preview panel */}
            {showPreview && form.template.trim() && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground">
                  Preview (with sample data)
                </Label>
                <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {previewText}
                </div>
              </div>
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
