import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStock, useDeleteStock } from "@/hooks/use-stocks";
import { PageHeader } from "@/components/page-header";
import { StockModal } from "@/components/stock-modal";
import { EmptyState } from "@/components/empty-state";
import { PageSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  TrendingUp,
  Building2,
  Tag,
  Calendar,
  FileText,
  FlaskConical,
} from "lucide-react";
import type { GenericId } from "convex/values";

export const Route = createFileRoute("/_authenticated/stocks/$stockId")({
  component: StockDetailPage,
});

function StockDetailPage() {
  const { stockId } = Route.useParams();
  const stock = useStock(stockId as GenericId<"stocks">);
  const navigate = useNavigate();
  const deleteStock = useDeleteStock();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    if (!stock) return;
    try {
      await deleteStock({ id: stock._id });
      navigate({ to: "/stocks" });
    } catch {
      setDeleteOpen(false);
    }
  }

  if (stock === undefined) {
    return <PageSkeleton />;
  }

  if (stock === null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="px-4 pt-4 md:px-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/stocks">
              <ArrowLeft className="size-4" />
              Back to Stocks
            </Link>
          </Button>
        </div>
        <EmptyState
          icon={TrendingUp}
          title="Stock not found"
          description="This stock may have been deleted."
          action={
            <Button size="sm" asChild>
              <Link to="/stocks">Back to Stocks</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const addedDate = new Date(stock.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const updatedDate = new Date(stock.updatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4 pt-4 md:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/stocks">
            <ArrowLeft className="size-4" />
            Back to Stocks
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${stock.ticker} — ${stock.companyName}`}
        description={`${stock.exchange}${stock.sector ? ` · ${stock.sector}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4 text-destructive" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 px-4 pb-4 md:grid-cols-2 md:px-6">
        {/* Stock Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" />
              Stock Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Ticker</dt>
                <dd className="font-medium">{stock.ticker}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Exchange</dt>
                <dd className="font-medium">{stock.exchange}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Sector</dt>
                <dd className="font-medium">{stock.sector || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  Added
                </dt>
                <dd>{addedDate}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3" />
                  Updated
                </dt>
                <dd>{updatedDate}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="size-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stock.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {stock.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tags</p>
            )}
          </CardContent>
        </Card>

        {/* Notes Card */}
        {stock.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{stock.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Research History Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="size-4" />
              Research History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FlaskConical}
              title="No research yet"
              description="Research results for this stock will appear here once you run a research job."
              className="py-6"
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <StockModal
        open={editOpen}
        onOpenChange={setEditOpen}
        stock={stock}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Stock</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {stock.ticker} ({stock.companyName}
              )? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
