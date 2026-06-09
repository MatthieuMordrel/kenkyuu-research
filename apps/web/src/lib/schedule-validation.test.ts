import { describe, expect, it } from "vitest";

import {
  describeCron,
  validateCron,
  validateTimezone,
} from "./schedule-validation";

describe("validateCron", () => {
  it("accepts presets", () => {
    expect(validateCron("@daily")).toBeUndefined();
    expect(validateCron("@hourly")).toBeUndefined();
    expect(validateCron(" @weekly ")).toBeUndefined();
  });

  it("accepts valid 5-field expressions", () => {
    expect(validateCron("0 9 * * 1")).toBeUndefined();
    expect(validateCron("*/15 0-6 1 1 *")).toBeUndefined();
  });

  it("requires a non-empty expression", () => {
    expect(validateCron("  ")).toBe("Cron expression is required");
  });

  it("rejects expressions without exactly 5 fields", () => {
    expect(validateCron("0 9 * *")).toMatch(/must have 5 fields/);
    expect(validateCron("0 9 * * 1 2026")).toMatch(/must have 5 fields/);
  });

  it("rejects out-of-range field values", () => {
    expect(validateCron("60 0 * * *")).toMatch(/Minute/);
    expect(validateCron("0 24 * * *")).toMatch(/Hour/);
    expect(validateCron("0 0 * * 7")).toMatch(/Day of week/);
  });
});

describe("validateTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(validateTimezone("Europe/Paris")).toBeUndefined();
    expect(validateTimezone("America/New_York")).toBeUndefined();
  });

  it("rejects unknown timezones", () => {
    expect(validateTimezone("Not/AZone")).toBeDefined();
  });
});

describe("describeCron", () => {
  it("describes presets", () => {
    expect(describeCron("@daily")).toBe("Daily at midnight");
    expect(describeCron("@monthly")).toBe("Monthly on the 1st at midnight");
  });

  it("describes daily, weekly, and monthly patterns", () => {
    expect(describeCron("5 9 * * *")).toBe("Daily at 9:05");
    expect(describeCron("30 18 * * 1")).toBe("Weekly on Mon at 18:30");
    expect(describeCron("0 8 15 * *")).toBe("Monthly on day 15 at 8:00");
  });

  it("falls back to the raw expression for unrecognized patterns", () => {
    expect(describeCron("*/10 * * * *")).toBe("*/10 * * * *");
  });
});
