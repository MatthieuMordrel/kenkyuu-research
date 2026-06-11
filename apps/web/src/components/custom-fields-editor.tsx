import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import {
  CUSTOM_FIELD_LIMITS,
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_META,
  type CustomFieldDefinition,
  type CustomFieldType,
} from "@repo/research-models/custom-fields";

interface CustomFieldsEditorProps {
  fields: CustomFieldDefinition[];
  onChange: (fields: CustomFieldDefinition[]) => void;
  /** Portal target for the type dropdowns so they render above the dialog. */
  portalContainer?: React.RefObject<HTMLElement | null> | HTMLElement | null;
}

function createFieldId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `field-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Editor for a prompt's custom output fields. Each field has a title, a type
 * (which tells the agent how to format the value), and a description that
 * instructs the agent what to fill in. The agent returns "Unavailable" for any
 * field it cannot support from its research.
 */
export function CustomFieldsEditor({
  fields,
  onChange,
  portalContainer,
}: CustomFieldsEditorProps) {
  const atMax = fields.length >= CUSTOM_FIELD_LIMITS.maxFields;

  function addField() {
    if (atMax) return;
    onChange([
      ...fields,
      { id: createFieldId(), title: "", description: "", type: "text" },
    ]);
  }

  function updateField(id: string, patch: Partial<CustomFieldDefinition>) {
    onChange(
      fields.map((field) => (field.id === id ? { ...field, ...patch } : field))
    );
  }

  function removeField(id: string) {
    onChange(fields.filter((field) => field.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Custom Output Fields</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          disabled={atMax}
        >
          <Plus className="size-3.5" />
          Add field
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Extra values the agent extracts for every run of this prompt (e.g.
        &ldquo;Estimated CAGR&rdquo;). The description tells the agent what to
        fill in; it returns &ldquo;Unavailable&rdquo; when its research
        can&rsquo;t support a value.
      </p>

      {fields.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          No custom fields. Add one to capture a specific value alongside the
          report.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3"
            >
              <div className="flex items-start gap-2">
                <Input
                  placeholder="Field title (e.g. Estimated CAGR)"
                  value={field.title}
                  maxLength={CUSTOM_FIELD_LIMITS.maxTitleLength}
                  onChange={(e) =>
                    updateField(field.id, { title: e.target.value })
                  }
                  className="flex-1"
                />
                <Select
                  modal={false}
                  value={field.type}
                  onValueChange={(value) =>
                    updateField(field.id, {
                      type: (value ?? "text") as CustomFieldType,
                    })
                  }
                >
                  <SelectTrigger className="w-36 shrink-0">
                    <SelectValue
                      render={(_, { value }) => (
                        <span>
                          {CUSTOM_FIELD_TYPE_META[value as CustomFieldType]
                            ?.label ?? "Text"}
                        </span>
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent
                    container={portalContainer ?? undefined}
                    alignItemWithTrigger={false}
                  >
                    {CUSTOM_FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CUSTOM_FIELD_TYPE_META[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(field.id)}
                  aria-label="Remove field"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <Textarea
                placeholder="Description — what should the agent fill in? (e.g. Compound annual growth rate over the next 3 years)"
                value={field.description}
                maxLength={CUSTOM_FIELD_LIMITS.maxDescriptionLength}
                onChange={(e) =>
                  updateField(field.id, { description: e.target.value })
                }
                rows={2}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
