import { describe, it, expect } from "vitest";
import {
  parseCron,
  parseField,
  matchesField,
  computeNextRunAt,
  type CronFields,
  type FieldSpec,
} from "../scheduleActions";

describe("parseField", () => {
  it("parses wildcard (*)", () => {
    const result = parseField("*", 0, 59);
    expect(result).toEqual({ type: "any" });
  });

  it("parses single value", () => {
    const result = parseField("5", 0, 59);
    expect(result).toEqual({ type: "values", values: new Set([5]) });
  });

  it("parses comma-separated values", () => {
    const result = parseField("1,5,10", 0, 59);
    expect(result).toEqual({ type: "values", values: new Set([1, 5, 10]) });
  });

  it("parses range (e.g. 1-5)", () => {
    const result = parseField("1-5", 0, 59);
    expect(result).toEqual({ type: "values", values: new Set([1, 2, 3, 4, 5]) });
  });

  it("parses step with wildcard (*/15)", () => {
    const result = parseField("*/15", 0, 59);
    expect(result).toEqual({
      type: "values",
      values: new Set([0, 15, 30, 45]),
    });
  });

  it("parses step with range (1-10/3)", () => {
    const result = parseField("1-10/3", 0, 59);
    expect(result).toEqual({
      type: "values",
      values: new Set([1, 4, 7, 10]),
    });
  });

  it("parses step with start value (5/10)", () => {
    const result = parseField("5/10", 0, 59);
    expect(result).toEqual({
      type: "values",
      values: new Set([5, 15, 25, 35, 45, 55]),
    });
  });

  it("parses combined comma, range, and step", () => {
    const result = parseField("1,5-7,*/30", 0, 59);
    expect(result).toEqual({
      type: "values",
      values: new Set([0, 1, 5, 6, 7, 30]),
    });
  });

  it("throws on invalid step value", () => {
    expect(() => parseField("*/0", 0, 59)).toThrow("Invalid step value");
    expect(() => parseField("*/-1", 0, 59)).toThrow("Invalid step value");
  });
});

describe("matchesField", () => {
  it("matches any field against any value", () => {
    const spec: FieldSpec = { type: "any" };
    expect(matchesField(spec, 0)).toBe(true);
    expect(matchesField(spec, 59)).toBe(true);
  });

  it("matches values field for included values", () => {
    const spec: FieldSpec = { type: "values", values: new Set([0, 15, 30, 45]) };
    expect(matchesField(spec, 0)).toBe(true);
    expect(matchesField(spec, 15)).toBe(true);
    expect(matchesField(spec, 10)).toBe(false);
  });
});

describe("parseCron", () => {
  it("parses standard 5-field cron expression", () => {
    const result = parseCron("0 9 * * *");
    expect(result.minute).toEqual({ type: "values", values: new Set([0]) });
    expect(result.hour).toEqual({ type: "values", values: new Set([9]) });
    expect(result.dayOfMonth).toEqual({ type: "any" });
    expect(result.month).toEqual({ type: "any" });
    expect(result.dayOfWeek).toEqual({ type: "any" });
  });

  it("parses @daily alias", () => {
    const result = parseCron("@daily");
    expect(result.minute).toEqual({ type: "values", values: new Set([0]) });
    expect(result.hour).toEqual({ type: "values", values: new Set([0]) });
    expect(result.dayOfMonth).toEqual({ type: "any" });
    expect(result.month).toEqual({ type: "any" });
    expect(result.dayOfWeek).toEqual({ type: "any" });
  });

  it("parses @midnight alias (same as @daily)", () => {
    const daily = parseCron("@daily");
    const midnight = parseCron("@midnight");
    expect(daily).toEqual(midnight);
  });

  it("parses @weekly alias", () => {
    const result = parseCron("@weekly");
    expect(result.minute).toEqual({ type: "values", values: new Set([0]) });
    expect(result.hour).toEqual({ type: "values", values: new Set([0]) });
    expect(result.dayOfMonth).toEqual({ type: "any" });
    expect(result.month).toEqual({ type: "any" });
    expect(result.dayOfWeek).toEqual({ type: "values", values: new Set([0]) });
  });

  it("parses @monthly alias", () => {
    const result = parseCron("@monthly");
    expect(result.minute).toEqual({ type: "values", values: new Set([0]) });
    expect(result.hour).toEqual({ type: "values", values: new Set([0]) });
    expect(result.dayOfMonth).toEqual({ type: "values", values: new Set([1]) });
    expect(result.month).toEqual({ type: "any" });
    expect(result.dayOfWeek).toEqual({ type: "any" });
  });

  it("parses @hourly alias", () => {
    const result = parseCron("@hourly");
    expect(result.minute).toEqual({ type: "values", values: new Set([0]) });
    expect(result.hour).toEqual({ type: "any" });
    expect(result.dayOfMonth).toEqual({ type: "any" });
  });

  it("parses complex cron with steps", () => {
    const result = parseCron("*/15 9-17 * * 1-5");
    expect(result.minute).toEqual({
      type: "values",
      values: new Set([0, 15, 30, 45]),
    });
    expect(result.hour).toEqual({
      type: "values",
      values: new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]),
    });
    expect(result.dayOfWeek).toEqual({
      type: "values",
      values: new Set([1, 2, 3, 4, 5]),
    });
  });

  it("throws on wrong number of fields", () => {
    expect(() => parseCron("0 9 *")).toThrow("expected 5 fields");
    expect(() => parseCron("0 9 * * * *")).toThrow("expected 5 fields");
  });

  it("trims whitespace", () => {
    expect(() => parseCron("  0 9 * * *  ")).not.toThrow();
  });
});

describe("computeNextRunAt", () => {
  it("computes the next run for a daily cron in UTC", () => {
    // 2025-01-15 08:30:00 UTC
    const afterMs = new Date("2025-01-15T08:30:00Z").getTime();
    // "0 9 * * *" = daily at 09:00 UTC
    const nextRun = computeNextRunAt("0 9 * * *", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    expect(nextDate.getUTCHours()).toBe(9);
    expect(nextDate.getUTCMinutes()).toBe(0);
    // Should be the same day (8:30 < 9:00)
    expect(nextDate.getUTCDate()).toBe(15);
  });

  it("advances to next day when time has passed", () => {
    // 2025-01-15 10:00:00 UTC (past 09:00)
    const afterMs = new Date("2025-01-15T10:00:00Z").getTime();
    const nextRun = computeNextRunAt("0 9 * * *", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    expect(nextDate.getUTCHours()).toBe(9);
    expect(nextDate.getUTCMinutes()).toBe(0);
    expect(nextDate.getUTCDate()).toBe(16);
  });

  it("handles hourly cron", () => {
    // 2025-01-15 08:45:00 UTC
    const afterMs = new Date("2025-01-15T08:45:00Z").getTime();
    const nextRun = computeNextRunAt("0 * * * *", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    expect(nextDate.getUTCHours()).toBe(9);
    expect(nextDate.getUTCMinutes()).toBe(0);
  });

  it("handles weekly cron (Mondays only)", () => {
    // 2025-01-15 is a Wednesday
    const afterMs = new Date("2025-01-15T10:00:00Z").getTime();
    // "0 9 * * 1" = every Monday at 9:00
    const nextRun = computeNextRunAt("0 9 * * 1", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    expect(nextDate.getUTCDay()).toBe(1); // Monday
    expect(nextDate.getUTCHours()).toBe(9);
  });

  it("handles @daily alias", () => {
    const afterMs = new Date("2025-01-15T01:00:00Z").getTime();
    const nextRun = computeNextRunAt("@daily", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    expect(nextDate.getUTCHours()).toBe(0);
    expect(nextDate.getUTCMinutes()).toBe(0);
  });

  it("handles every-15-minutes cron", () => {
    const afterMs = new Date("2025-01-15T08:03:00Z").getTime();
    const nextRun = computeNextRunAt("*/15 * * * *", "UTC", afterMs);
    const nextDate = new Date(nextRun);
    // Should be at xx:15 (next 15-min mark after 08:03)
    expect(nextDate.getUTCMinutes()).toBe(15);
  });

  it("returns a time in the future", () => {
    const afterMs = Date.now();
    const nextRun = computeNextRunAt("0 0 * * *", "UTC", afterMs);
    expect(nextRun).toBeGreaterThan(afterMs);
  });
});
