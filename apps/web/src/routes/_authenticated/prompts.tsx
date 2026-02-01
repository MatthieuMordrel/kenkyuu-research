import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { usePrompts, useDeletePrompt, useClonePrompt } from "@/hooks/use-prompts";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/loading-skeleton";
import { PromptModal } from "@/components/prompt-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, FileText, Pencil, Trash2, Copy } from "lucide-react";
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

function PromptsPage() {
  const [selectedType, setSelectedType] = useState<PromptType | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Doc<"prompts"> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"prompts"> | null>(null);

  const prompts = usePrompts({
    type: selectedType === "all" ? undefined : selectedType,
  });
  const deletePrompt = useDeletePrompt();
  const clonePrompt = useClonePrompt();

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
        actions={
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            New Prompt
          </Button>
        }
      />

      <div className="flex flex-col gap-3 px-4 md:px-6">
        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedType(tab.value)}
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                selectedType === tab.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt list */}
      <div className="px-4 pb-4 md:px-6">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : prompts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={selectedType !== "all" ? "No prompts found" : "No prompts yet"}
            description={
              selectedType !== "all"
                ? "No prompts match the selected type filter."
                : "Create your first prompt template to get started with research."
            }
            action={
              selectedType === "all" ? (
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-4" />
                  New Prompt
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
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
  return (
    <Card className="py-3">
      <CardContent className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{prompt.name}</span>
            {prompt.isBuiltIn && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Built-in
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground line-clamp-2">
            {prompt.description}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {TYPE_LABELS[prompt.type]}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      </CardContent>
    </Card>
  );
}
