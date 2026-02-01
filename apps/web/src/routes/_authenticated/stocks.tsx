import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/stocks")({
  component: StocksPage,
});

function StocksPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Stocks</h1>
      <p className="text-muted-foreground mt-2">Manage your stock watchlist</p>
    </div>
  );
}
