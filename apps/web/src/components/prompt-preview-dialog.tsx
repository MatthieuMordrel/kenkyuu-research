import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useState } from "react";

interface PromptPreviewDialogProps {
  /** The resolved prompt content to display */
  content: string;
  /** Optional trigger label (defaults to "Prompt Preview") */
  label?: string;
  /** Render a custom trigger instead of the default button */
  trigger?: (open: () => void) => React.ReactNode;
}

export function PromptPreviewDialog({
  content,
  label = "Prompt Preview",
  trigger,
}: PromptPreviewDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {trigger ? (
        trigger(() => setOpen(true))
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5"
        >
          <Eye className="size-3.5" />
          {label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!max-w-[calc(100vw-2rem)] w-full max-h-[95vh] h-[95vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto overflow-x-hidden flex-1 pr-2 min-w-0">
            <MarkdownRenderer content={content} collapsible={false} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
