import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  usePrompts,
  useDeletePrompt,
  useClonePrompt,
} from "@/hooks/use-prompts";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/loading-skeleton";
import { PromptModal } from "@/components/prompt-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  Copy,
  Sparkles,
  TrendingUp,
  BarChart3,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Doc } from "@repo/convex/dataModel";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: PromptsPage,
});

type PromptType = "single-stock" | "multi-stock" | "discovery";

const TYPE_TABS: { value: PromptType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "single-stock", label: "Single Stock" },
  { value: "multi-stock", label: "Multi Stock" },
  { value: "discovery", label: "Discovery" },
];

const TYPE_LABELS: Record<PromptType, string> = {
  "single-stock": "Single Stock",
  "multi-stock": "Multi Stock",
  discovery: "Discovery",
};

const TYPE_CONFIG: Record<
  PromptType,
  { icon: typeof TrendingUp; color: string }
> = {
  "single-stock": {
    icon: TrendingUp,
    color:
      "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  },
  "multi-stock": {
    icon: BarChart3,
    color:
      "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  },
  discovery: {
    icon: Search,
    color:
      "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
};

function PromptsPage() {
  const [selectedType, setSelectedType] = useState<PromptType | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Doc<"prompts"> | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<Doc<"prompts"> | null>(null);

  const allPrompts = usePrompts();
  const deletePrompt = useDeletePrompt();
  const clonePrompt = useClonePrompt();

  const prompts = allPrompts
    ? selectedType === "all"
      ? allPrompts
      : allPrompts.filter((p) => p.type === selectedType)
    : undefined;
  function openEdit(prompt: Doc<"prompts">) {
    setEditingPrompt(prompt);
    setModalOpen(true);
  }

  function openAdd() {
    setEditingPrompt(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deletePrompt({ id: deleteTarget._id });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleClone(prompt: Doc<"prompts">) {
    await clonePrompt({ id: prompt._id });
  }

  const isLoading = prompts === undefined;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Prompts"
        description="Manage research prompt templates"
      >
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          New Prompt
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedType(tab.value)}
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-all",
                selectedType === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {tab.label}
              {!isLoading && allPrompts && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[10px]",
                    selectedType === tab.value
                      ? "bg-primary-foreground/20"
                      : "bg-foreground/5"
                  )}
                >
                  {tab.value === "all"
                    ? allPrompts.length
                    : allPrompts.filter((p) => p.type === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt list */}
      <div className="px-4 pb-4 md:px-6">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              {selectedType !== "all" ? (
                <FileText className="size-5 text-muted-foreground" />
              ) : (
                <Sparkles className="size-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {selectedType !== "all" ? "No prompts found" : "No prompts yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedType !== "all"
                  ? "No prompts match the selected type filter."
                  : "Create your first prompt template to get started."}
              </p>
            </div>
            {selectedType === "all" && (
              <Button
                size="sm"
                variant="outline"
                onClick={openAdd}
                className="mt-1"
              >
                <Plus className="size-4" />
                New Prompt
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {prompts.map((prompt) => (
              <PromptCard
                key={prompt._id}
                prompt={prompt}
                onEdit={() => openEdit(prompt)}
                onDelete={() => setDeleteTarget(prompt)}
                onClone={() => handleClone(prompt)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <PromptModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        prompt={editingPrompt}
      />

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromptCard({
  prompt,
  onEdit,
  onDelete,
  onClone,
}: {
  prompt: Doc<"prompts">;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const config = TYPE_CONFIG[prompt.type];
  const TypeIcon = config.icon;

  return (
    <div className="group flex h-16 items-center gap-3 rounded-xl px-3 transition-all hover:bg-accent">
      {/* Type icon */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          config.color
        )}
      >
        <TypeIcon className="size-4" />
      </div>

      {/* Content — two rows */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{prompt.name}</span>
          {prompt.isBuiltIn && (
            <Badge
              variant="secondary"
              className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
            >
              Built-in
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="shrink-0 whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
          >
            {TYPE_LABELS[prompt.type]}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {prompt.description}
          </span>
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClone}
          title="Clone prompt"
        >
          <Copy className="size-3.5" />
          <span className="sr-only">Clone</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          title="Edit prompt"
        >
          <Pencil className="size-3.5" />
          <span className="sr-only">Edit</span>
        </Button>
        {!prompt.isBuiltIn && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title="Delete prompt"
          >
            <Trash2 className="size-3.5 text-destructive" />
            <span className="sr-only">Delete</span>
          </Button>
        )}
      </div>
    </div>
  );
}
