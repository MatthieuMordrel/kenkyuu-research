import type { CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useRecentResearch,
  useUpcomingSchedules,
  useMonthlySpend,
  useActiveJobsCount,
  useQuickActions,
} from "@/hooks/use-dashboard";
import { PageHeader } from "@/components/page-header";
import { CardSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  FlaskConical,
  Clock,
  Plus,
  History,
  Calendar,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

function progressWidthStyle(percent: number): CSSProperties {
  return { width: `${Math.min(percent, 100)}%` };
}

function jobLinkParams<T>(jobId: T) {
  return { jobId };
}

function DashboardPage() {
  const quickActions = useQuickActions();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description="Overview of your research activity and costs"
      >
        <Button size="sm" onClick={quickActions.startNewResearch}>
          <Plus className="mr-1.5 size-4" />
          New Research
        </Button>
      </PageHeader>
      <div className="flex flex-col gap-6 px-4 pb-4 md:px-6">
        <OverviewCards />
        <QuickActions />
        <div className="grid gap-6 md:grid-cols-2">
          <RecentResearchCard />
          <UpcomingSchedulesCard />
        </div>
      </div>
    </div>
  );
}

function OverviewCards() {
  const monthlySpend = useMonthlySpend();
  const activeJobs = useActiveJobsCount();

  if (monthlySpend === undefined || activeJobs === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const budget = monthlySpend.budgetThreshold ?? null;
  const percentUsed = budget ? (monthlySpend.totalCost / budget) * 100 : null;
  const openai = activeJobs.byProvider.openai;
  const anthropic = activeJobs.byProvider.anthropic;
  const totalCapacity = openai.limit + anthropic.limit;
  const totalActive = openai.active + anthropic.active;
  const slotsAvailable = Math.max(totalCapacity - totalActive, 0);
  const capacityUsedPercent =
    totalCapacity > 0 ? (totalActive / totalCapacity) * 100 : 0;
  const atAnyCapacity = openai.atCapacity || anthropic.atCapacity;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Monthly Spend</CardDescription>
            <DollarSign className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl tabular-nums">
            ${monthlySpend.totalCost.toFixed(2)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {monthlySpend.jobCount} research{" "}
            {monthlySpend.jobCount === 1 ? "run" : "runs"} this month
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
                  style={progressWidthStyle(percentUsed)}
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

      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Active Jobs</CardDescription>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl tabular-nums">
            {activeJobs.total}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {activeJobs.running} running
            {activeJobs.formatting > 0
              ? `, ${activeJobs.formatting} formatting`
              : ""}
            , {activeJobs.pending} queued · OpenAI {openai.active}/
            {openai.limit}, Anthropic {anthropic.active}/{anthropic.limit}
          </p>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardDescription>Capacity</CardDescription>
            <FlaskConical className="size-4 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl tabular-nums">
            {slotsAvailable}/{totalCapacity}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  atAnyCapacity
                    ? "bg-amber-500"
                    : capacityUsedPercent > 85
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={progressWidthStyle(capacityUsedPercent)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {atAnyCapacity
                ? "One or more providers at capacity — new jobs queue automatically"
                : "Slots available across providers"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickActions() {
  const quickActions = useQuickActions();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={quickActions.startNewResearch}
      >
        <FlaskConical className="mr-1.5 size-4" />
        New Research
      </Button>
      <Button variant="outline" size="sm" onClick={quickActions.goToAddStock}>
        <Plus className="mr-1.5 size-4" />
        Add Stock
      </Button>
      <Button variant="outline" size="sm" onClick={quickActions.goToHistory}>
        <History className="mr-1.5 size-4" />
        View History
      </Button>
      <Button variant="outline" size="sm" onClick={quickActions.goToSchedules}>
        <Calendar className="mr-1.5 size-4" />
        Schedules
      </Button>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RecentResearchCard() {
  const recentResearch = useRecentResearch();

  if (recentResearch === undefined) {
    return <CardSkeleton />;
  }

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Recent Research</CardTitle>
            {recentResearch.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                {recentResearch.length}
              </span>
            )}
          </div>
          <Link
            to="/research"
            className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
            <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <CardDescription>Last 5 completed research runs</CardDescription>
      </CardHeader>
      <CardContent>
        {recentResearch.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Sparkles className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No research yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Start your first research to see results here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {recentResearch.map((job) => (
              <Link
                key={job._id}
                to="/research/$jobId"
                params={jobLinkParams(job._id)}
                className="group relative flex items-center gap-3 rounded-xl p-2.5 transition-all hover:bg-accent"
              >
                {/* Status indicator */}
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                    job.status === "completed"
                      ? "bg-green-500/10 dark:bg-green-500/20"
                      : "bg-destructive/10 dark:bg-destructive/20"
                  }`}
                >
                  {job.status === "completed" ? (
                    <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="size-4 text-destructive" />
                  )}
                </div>

                {/* Content */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {job.promptName}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatRelativeTime(new Date(job.createdAt))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {job.stockTickers.length > 0 ? (
                        job.stockTickers.slice(0, 3).map((ticker) => (
                          <Badge
                            key={ticker}
                            variant="secondary"
                            className="whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
                          >
                            {ticker}
                          </Badge>
                        ))
                      ) : (
                        <Badge
                          variant="secondary"
                          className="whitespace-nowrap rounded-md px-1.5 py-0 text-[10px] font-semibold tracking-wide"
                        >
                          Discovery
                        </Badge>
                      )}
                      {job.stockTickers.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{job.stockTickers.length - 3}
                        </span>
                      )}
                    </div>
                    {job.costUsd != null && (
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        ${job.costUsd.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingSchedulesCard() {
  const upcomingSchedules = useUpcomingSchedules();

  if (upcomingSchedules === undefined) {
    return <CardSkeleton />;
  }

  return (
    <Card className="py-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Upcoming Runs</CardTitle>
          <Link
            to="/schedules"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <CardDescription>Next scheduled research runs</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingSchedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming scheduled runs. Create a schedule to automate research.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {upcomingSchedules.map((schedule) => (
              <div
                key={schedule._id}
                className="flex items-start gap-3 rounded-lg p-2"
              >
                <div className="mt-0.5">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">
                    {schedule.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {schedule.promptName}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(schedule.nextRunAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )}
                    </span>
                    {schedule.timezone && <span>{schedule.timezone}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
