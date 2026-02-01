"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Parse a cron expression and compute the next run time after `afterMs` in the given timezone.
 *
 * Supports standard 5-field cron: minute hour dayOfMonth month dayOfWeek
 * Also supports preset aliases: @daily, @weekly, @monthly, @hourly
 */
function computeNextRunAt(cronExpr: string, timezone: string, afterMs: number): number {
  const parsed = parseCron(cronExpr);
  const after = new Date(afterMs);

  // Start from the next minute after `after`
  const candidate = new Date(after);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  // Try each minute for up to 366 days to find the next match
  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    const tzParts = getDatePartsInTimezone(candidate, timezone);

    if (
      matchesField(parsed.minute, tzParts.minute) &&
      matchesField(parsed.hour, tzParts.hour) &&
      matchesField(parsed.dayOfMonth, tzParts.dayOfMonth) &&
      matchesField(parsed.month, tzParts.month) &&
      matchesField(parsed.dayOfWeek, tzParts.dayOfWeek)
    ) {
      return getUtcTimestampFromTzParts(tzParts, timezone);
    }

    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  // Fallback: 24 hours from now
  return afterMs + 24 * 60 * 60 * 1000;
}

interface CronFields {
  minute: FieldSpec;
  hour: FieldSpec;
  dayOfMonth: FieldSpec;
  month: FieldSpec;
  dayOfWeek: FieldSpec;
}

type FieldSpec = { type: "any" } | { type: "values"; values: Set<number> };

function parseCron(expr: string): CronFields {
  const trimmed = expr.trim();

  if (trimmed === "@daily" || trimmed === "@midnight") {
    return parseCron("0 0 * * *");
  }
  if (trimmed === "@weekly") {
    return parseCron("0 0 * * 0");
  }
  if (trimmed === "@monthly") {
    return parseCron("0 0 1 * *");
  }
  if (trimmed === "@hourly") {
    return parseCron("0 * * * *");
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minute: parseField(parts[0]!, 0, 59),
    hour: parseField(parts[1]!, 0, 23),
    dayOfMonth: parseField(parts[2]!, 1, 31),
    month: parseField(parts[3]!, 1, 12),
    dayOfWeek: parseField(parts[4]!, 0, 6),
  };
}

function parseField(field: string, min: number, max: number): FieldSpec {
  if (field === "*") {
    return { type: "any" };
  }

  const values = new Set<number>();

  const segments = field.split(",");
  for (const segment of segments) {
    if (segment.includes("/")) {
      const [rangeStr, stepStr] = segment.split("/");
      const step = Number.parseInt(stepStr!, 10);
      if (Number.isNaN(step) || step <= 0) {
        throw new Error(`Invalid step value in cron field: ${field}`);
      }

      let start = min;
      let end = max;

      if (rangeStr !== "*") {
        if (rangeStr!.includes("-")) {
          const [rStart, rEnd] = rangeStr!.split("-").map((s) => Number.parseInt(s, 10));
          start = rStart!;
          end = rEnd!;
        } else {
          start = Number.parseInt(rangeStr!, 10);
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    } else if (segment.includes("-")) {
      const [start, end] = segment.split("-").map((s) => Number.parseInt(s, 10));
      for (let i = start!; i <= end!; i++) {
        values.add(i);
      }
    } else {
      values.add(Number.parseInt(segment, 10));
    }
  }

  return { type: "values", values };
}

function matchesField(spec: FieldSpec, value: number): boolean {
  if (spec.type === "any") return true;
  return spec.values.has(value);
}

interface TzDateParts {
  year: number;
  month: number;
  dayOfMonth: number;
  dayOfWeek: number;
  hour: number;
  minute: number;
}

function getDatePartsInTimezone(date: Date, timezone: string): TzDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? Number.parseInt(part.value, 10) : 0;
  };

  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: get("year"),
    month: get("month"),
    dayOfMonth: get("day"),
    dayOfWeek: weekdayMap[weekdayStr] ?? 0,
    hour: get("hour") === 24 ? 0 : get("hour"),
    minute: get("minute"),
  };
}

function getUtcTimestampFromTzParts(parts: TzDateParts, timezone: string): number {
  const isoStr = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.dayOfMonth).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:00`;

  const roughUtc = new Date(isoStr + "Z").getTime();
  const roughParts = getDatePartsInTimezone(new Date(roughUtc), timezone);
  const roughOffsetMinutes =
    (roughParts.hour * 60 + roughParts.minute) - (parts.hour * 60 + parts.minute);

  return roughUtc - roughOffsetMinutes * 60 * 1000;
}

// --- Actions ---

/**
 * Compute and schedule the next run for a given schedule.
 * Called when a schedule is created, enabled, or after a run completes.
 */
export const scheduleNextRun = internalAction({
  args: {
    scheduleId: v.id("schedules"),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(internal.schedules.getScheduleInternal, {
      id: args.scheduleId,
    });

    if (!schedule || !schedule.enabled) {
      return;
    }

    // Check global pause
    const globalPaused = await ctx.runQuery(internal.schedules.getGlobalPauseStatusInternal, {});
    if (globalPaused) {
      return;
    }

    // Compute next run time
    const now = Date.now();
    const nextRunAt = computeNextRunAt(schedule.cron, schedule.timezone, now);

    // Schedule the execution action at that time
    const delayMs = Math.max(0, nextRunAt - now);
    const scheduledId = await ctx.scheduler.runAfter(
      delayMs,
      internal.scheduleActions.executeScheduledRun,
      { scheduleId: args.scheduleId },
    );

    // Update the schedule with nextRunAt and the scheduled function ID
    await ctx.runMutation(internal.schedules.updateScheduleNextRun, {
      id: args.scheduleId,
      nextRunAt,
      nextScheduledFunctionId: scheduledId as unknown as string,
    });
  },
});

/**
 * Execute a scheduled research run and self-reschedule the next one.
 * This is the core self-rescheduling pattern: run -> schedule next -> repeat.
 */
export const executeScheduledRun = internalAction({
  args: {
    scheduleId: v.id("schedules"),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.runQuery(internal.schedules.getScheduleInternal, {
      id: args.scheduleId,
    });

    if (!schedule || !schedule.enabled) {
      return;
    }

    // Check global pause
    const globalPaused = await ctx.runQuery(internal.schedules.getGlobalPauseStatusInternal, {});
    if (globalPaused) {
      return;
    }

    // Resolve stock IDs based on stock selection mode
    let stockIds: Id<"stocks">[] = [];

    if (schedule.stockSelection.type === "none") {
      stockIds = [];
    } else if (schedule.stockSelection.type === "specific") {
      stockIds = (schedule.stockSelection.stockIds ?? []) as Id<"stocks">[];
    } else {
      // For "all" and "tagged", fetch stocks
      const allStocks = await ctx.runQuery(internal.schedules.listStocksInternal, {});

      if (schedule.stockSelection.type === "all") {
        stockIds = allStocks.map((s) => s._id);
      } else if (schedule.stockSelection.type === "tagged" && schedule.stockSelection.tags) {
        const tagSet = new Set(schedule.stockSelection.tags);
        stockIds = allStocks
          .filter((s) => s.tags.some((t: string) => tagSet.has(t)))
          .map((s) => s._id);
      }
    }

    // Create and start the research job
    try {
      await ctx.runMutation(internal.schedules.createScheduledJob, {
        promptId: schedule.promptId,
        stockIds,
        provider: schedule.provider,
        scheduleId: args.scheduleId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Scheduled run failed for schedule ${args.scheduleId}: ${message}`);
    }

    // Update lastRunAt
    await ctx.runMutation(internal.schedules.updateScheduleNextRun, {
      id: args.scheduleId,
      lastRunAt: Date.now(),
    });

    // Self-reschedule: compute and schedule the next run
    await ctx.runAction(internal.scheduleActions.scheduleNextRun, {
      scheduleId: args.scheduleId,
    });
  },
});
