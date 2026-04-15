import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptType } from "@/lib/schedule-validation";
import { PROMPT_TYPE_CONFIG, type PromptStepProps } from "./constants";

export function PromptStep({
  form,
  errors,
  prompts,
  promptSearch,
  setPromptSearch,
  updateField,
  setErrors,
}: PromptStepProps) {
  const filteredPrompts = useMemo(() => {
    if (!prompts) return undefined;
    if (!promptSearch.trim()) return prompts;
    const q = promptSearch.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q),
    );
  }, [prompts, promptSearch]);

  return (
    <div className="flex flex-col gap-3">
      {prompts === undefined ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No prompts available. Create a prompt first.
          </p>
        </div>
      ) : (
        <>
          {prompts.length > 5 && (
            <Input
              placeholder="Search prompts..."
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              className="h-8 text-sm"
            />
          )}

          <div className="flex flex-col gap-1.5">
            {filteredPrompts?.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No prompts match your search.
              </p>
            )}
            {filteredPrompts?.map((prompt) => {
              const isSelected = form.promptId === prompt._id;
              const typeConfig = PROMPT_TYPE_CONFIG[prompt.type as PromptType];

              return (
                <button
                  key={prompt._id}
                  type="button"
                  onClick={() => {
                    updateField("promptId", prompt._id);
                    setErrors((prev) => ({ ...prev, promptId: undefined }));
                  }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-foreground/20 hover:bg-accent/50",
                  )}
                >
                  <span className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected
                      ? "border-primary"
                      : "border-muted-foreground/30",
                  )}>
                    {isSelected && (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{prompt.name}</span>
                      {typeConfig && (
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 text-[10px] px-1.5 py-0", typeConfig.className)}
                        >
                          {typeConfig.label}
                        </Badge>
                      )}
                    </div>
                    {prompt.description && (
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {prompt.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {errors.promptId && (
        <p className="text-xs text-destructive">{errors.promptId}</p>
      )}
    </div>
  );
}
