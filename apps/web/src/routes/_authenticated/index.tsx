import { createFileRoute } from "@tanstack/react-router";
import { useMonthlyCost, useCostHistory, useCostByProvider } from "@/hooks/use-costs";
import { useSettings } from "@/hooks/use-settings";
import { PageHeader } from "@/components/page-header";
import { CardSkeleton } from "@/components/loading-skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DollarSign, TrendingUp, BarChart3, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="Overview of your research costs and usage"
      />
      <div className="flex flex-col gap-6 px-4 pb-4 md:px-6">
        <CostSummaryCards />
        <ProviderBreakdown />
        <CostHistoryChart />
      </div>
    </div>
  );
}

function CostSummaryCards() {
  const monthlyCost = useMonthlyCost();
  const budgetThreshold = useSettings("budget_threshold");

  if (monthlyCost === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const budget = budgetThreshold ? Number.parseFloat(budgetThreshold) : null;
  const percentUsed = budget ? (monthlyCost.totalCost / budget) * 100 : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Monthly Spend</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl tabular-nums">
            ${monthlyCost.totalCost.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {monthlyCost.jobCount} research {monthlyCost.jobCount === 1 ? "run" : "runs"} this month
          </p>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Budget</CardDescription>
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl tabular-nums">
            {budget != null ? `$${budget.toFixed(2)}` : "Not set"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {percentUsed != null ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentUsed > 90
                      ? "bg-destructive"
                      : percentUsed > 70
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(percentUsed, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {percentUsed.toFixed(0)}% used
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Set a budget in Settings
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderBreakdown() {
  const costByProvider = useCostByProvider();

  if (costByProvider === undefined) {
    return <CardSkeleton />;
  }

  if (costByProvider.length === 0) {
    return (
      <Card className="py-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Spend by Provider</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No cost data yet. Run some research to see provider breakdown.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalCost = costByProvider.reduce((sum, p) => sum + p.totalCost, 0);

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Spend by Provider</CardTitle>
          <Layers className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {costByProvider.map((entry) => {
            const percent = totalCost > 0 ? (entry.totalCost / totalCost) * 100 : 0;
            return (
              <div key={entry.provider} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{entry.provider}</span>
                  <span className="tabular-nums text-muted-foreground">
                    ${entry.totalCost.toFixed(2)} ({entry.jobCount} {entry.jobCount === 1 ? "run" : "runs"})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CostHistoryChart() {
  const costHistory = useCostHistory({ months: 6 });

  if (costHistory === undefined) {
    return <CardSkeleton />;
  }

  const maxCost = Math.max(...costHistory.map((m) => m.totalCost), 1);

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Historical Spend</CardTitle>
          <BarChart3 className="size-4 text-muted-foreground" />
        </div>
        <CardDescription>Last 6 months</CardDescription>
      </CardHeader>
      <CardContent>
        {costHistory.every((m) => m.totalCost === 0) ? (
          <p className="text-sm text-muted-foreground">
            No cost data yet. Run some research to see historical trends.
          </p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {costHistory.map((entry) => {
              const heightPercent = maxCost > 0 ? (entry.totalCost / maxCost) * 100 : 0;
              const [year, monthNum] = entry.month.split("-");
              const monthLabel = new Date(
                Number(year),
                Number(monthNum) - 1,
              ).toLocaleDateString("en-US", { month: "short" });

              return (
                <div
                  key={entry.month}
                  className="flex flex-1 flex-col items-center gap-1"
                >
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {entry.totalCost > 0 ? `$${entry.totalCost.toFixed(0)}` : ""}
                  </span>
                  <div className="relative w-full flex-1">
                    <div
                      className="absolute inset-x-1 bottom-0 rounded-t bg-primary/80 transition-all"
                      style={{
                        height: `${Math.max(heightPercent, entry.totalCost > 0 ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{monthLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
