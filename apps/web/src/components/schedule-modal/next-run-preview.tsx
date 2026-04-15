import { useMemo } from "react";
import {
  describeCron,
  computeNextCronRun,
  formatNextRun,
  type EarningsConfigFormData,
} from "@/lib/schedule-validation";
import type { EarningsSummaryMap } from "./constants";

interface NextRunPreviewProps {
  triggerType: "cron" | "earnings";
  cron: string;
  timezone: string;
  earningsConfig: EarningsConfigFormData;
  resolvedStockIds: string[];
  earningsSummary: EarningsSummaryMap | undefined;
}

export function NextRunPreview({
  triggerType,
  cron,
  timezone,
  earningsConfig,
  resolvedStockIds,
  earningsSummary,
}: NextRunPreviewProps) {
  const nextRun = useMemo(() => {
    if (triggerType !== "cron") return null;
    return computeNextCronRun(cron, timezone);
  }, [triggerType, cron, timezone]);

  const earningsNextRun = useMemo(() => {
    if (triggerType !== "earnings" || !earningsSummary || resolvedStockIds.length === 0) return null;
    const mode = earningsConfig.earningsMode ?? "each";
    const offset = earningsConfig.offsetDays ?? 0;

    const nextDates: string[] = [];
    for (const id of resolvedStockIds) {
      const summary = earningsSummary[id];
      if (summary?.next?.date) nextDates.push(summary.next.date);
    }
    if (nextDates.length === 0) return null;
    nextDates.sort();

    if (mode === "each") {
      const d = new Date(nextDates[0]!);
      d.setDate(d.getDate() + offset);
      return {
        date: d,
        label: `Earliest of ${nextDates.length} stock${nextDates.length > 1 ? "s" : ""}`,
      };
    }
    if (mode === "before_first") {
      const d = new Date(nextDates[0]!);
      d.setDate(d.getDate() + offset);
      return { date: d, label: "Triggers at first earnings date" };
    }
    if (mode === "after_last") {
      const d = new Date(nextDates[nextDates.length - 1]!);
      d.setDate(d.getDate() + offset);
      const missing = resolvedStockIds.length - nextDates.length;
      const note = missing > 0 ? ` (${missing} without date)` : "";
      return { date: d, label: `Triggers after last earnings date${note}` };
    }
    return null;
  }, [triggerType, earningsSummary, resolvedStockIds, earningsConfig]);

  if (triggerType === "earnings") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
        <span className="mt-0.5 text-sm">⏱</span>
        <div className="flex flex-col gap-0.5">
          {earningsNextRun ? (
            <>
              <span className="text-sm font-medium">
                Next run:{" "}
                {earningsNextRun.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs text-muted-foreground">
                {earningsNextRun.label} · Checked hourly
              </span>
            </>
          ) : (
            <>
              <span className="text-sm font-medium">Triggers based on earnings dates</span>
              <span className="text-xs text-muted-foreground">
                Checked hourly — triggers when an earnings date matches
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!nextRun) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2.5">
      <span className="mt-0.5 text-sm">📅</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Next run: {formatNextRun(nextRun, timezone)}</span>
        <span className="text-xs text-muted-foreground">
          {describeCron(cron)} · {timezone}
        </span>
      </div>
    </div>
  );
}
