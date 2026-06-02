import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useState, type ReactNode } from "react";

interface PromptPreviewDialogProps {
  /** The resolved prompt content to display */
  content: string;
  /** Optional trigger label (defaults to "Prompt Preview") */
  label?: string;
  /** Optional helper text shown under the dialog title */
  description?: string;
  /** Optional content rendered below the markdown body in the scroll area */
  footer?: ReactNode;
  /** Render a custom trigger instead of the default button */
  trigger?: (open: () => void) => React.ReactNode;
}

export function PromptPreviewDialog({
  content,
  label = "Prompt Preview",
  description,
  footer,
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
        <DialogContent className="flex max-h-[min(95dvh,95svh)] w-full !max-w-[calc(100%-2rem)] flex-col sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto pr-1">
            <MarkdownRenderer content={content} collapsible={false} />
            {footer}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
