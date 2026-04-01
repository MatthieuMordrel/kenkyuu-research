import { describe, it, expect } from "vitest";
import { addDays, getTodayInTimezone } from "../earningsTriggerActions";

describe("addDays", () => {
  it("adds 0 days (identity)", () => {
    expect(addDays("2026-04-01", 0)).toBe("2026-04-01");
  });

  it("adds positive days", () => {
    expect(addDays("2026-04-01", 3)).toBe("2026-04-04");
  });

  it("subtracts days (negative offset)", () => {
    expect(addDays("2026-04-01", -2)).toBe("2026-03-30");
  });

  it("handles month boundary forward", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("handles month boundary backward", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles year boundary forward", () => {
    expect(addDays("2025-12-30", 3)).toBe("2026-01-02");
  });

  it("handles year boundary backward", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap year (Feb 29)", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("handles large offsets", () => {
    expect(addDays("2026-04-01", 14)).toBe("2026-04-15");
    expect(addDays("2026-04-01", -7)).toBe("2026-03-25");
  });
});

describe("getTodayInTimezone", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    const result = getTodayInTimezone("America/New_York");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid date for UTC", () => {
    const result = getTodayInTimezone("UTC");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a valid date for various timezones", () => {
    for (const tz of ["Asia/Tokyo", "Europe/London", "US/Pacific"]) {
      const result = getTodayInTimezone(tz);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("earnings trigger date math", () => {
  // The core formula: targetEarningsDate = addDays(today, -offsetDays)
  // This verifies the offset logic makes sense

  it("offset=0: target is today (trigger on earnings day)", () => {
    const today = "2026-04-15";
    const target = addDays(today, -0);
    expect(target).toBe("2026-04-15");
  });

  it("offset=1: target is yesterday (trigger 1 day after earnings)", () => {
    const today = "2026-04-15";
    const target = addDays(today, -1);
    expect(target).toBe("2026-04-14");
  });

  it("offset=2: target is 2 days ago (trigger 2 days after earnings)", () => {
    const today = "2026-04-15";
    const target = addDays(today, -2);
    expect(target).toBe("2026-04-13");
  });

  it("offset=-1: target is tomorrow (trigger 1 day before earnings)", () => {
    const today = "2026-04-15";
    const target = addDays(today, 1);
    expect(target).toBe("2026-04-16");
  });

  it("offset=-3: target is 3 days from now (trigger 3 days before earnings)", () => {
    const today = "2026-04-15";
    const target = addDays(today, 3);
    expect(target).toBe("2026-04-18");
  });
});
