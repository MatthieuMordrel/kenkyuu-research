import { describe, expect, it } from "vitest";

import {
  hasErrors,
  normalizeTicker,
  validateCompanyName,
  validateStockForm,
  validateTicker,
} from "./stock-validation";

describe("normalizeTicker", () => {
  it("trims whitespace and uppercases", () => {
    expect(normalizeTicker("  aapl ")).toBe("AAPL");
  });
});

describe("validateTicker", () => {
  it("accepts valid tickers, including after normalization", () => {
    expect(validateTicker("AAPL")).toBeUndefined();
    expect(validateTicker("brk.b")).toBeUndefined();
    expect(validateTicker("^GSPC")).toBeUndefined();
    expect(validateTicker("EURUSD=X")).toBeUndefined();
  });

  it("requires a non-empty ticker", () => {
    expect(validateTicker("")).toBe("Ticker is required");
    expect(validateTicker("   ")).toBe("Ticker is required");
  });

  it("rejects tickers with invalid characters or excessive length", () => {
    expect(validateTicker("AA PL")).toMatch(/must be 1–10/);
    expect(validateTicker("A".repeat(11))).toMatch(/must be 1–10/);
  });
});

describe("validateCompanyName", () => {
  it("requires a non-blank name", () => {
    expect(validateCompanyName("  ")).toBe("Company name is required");
    expect(validateCompanyName("Apple Inc.")).toBeUndefined();
  });
});

describe("validateStockForm / hasErrors", () => {
  it("returns no errors for a fully valid form", () => {
    const errors = validateStockForm({
      ticker: "MSFT",
      companyName: "Microsoft",
      exchange: "NASDAQ",
      tags: [],
    });
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("collects an error per invalid field", () => {
    const errors = validateStockForm({
      ticker: "",
      companyName: " ",
      exchange: "",
      tags: ["tech"],
    });
    expect(errors.ticker).toBe("Ticker is required");
    expect(errors.companyName).toBe("Company name is required");
    expect(errors.exchange).toBe("Exchange is required");
    expect(hasErrors(errors)).toBe(true);
  });
});
