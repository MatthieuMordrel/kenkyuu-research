import { describe, it, expect } from "vitest";
import {
  validateTicker,
  validateStringLength,
  validateStockInput,
  validatePromptInput,
  validateScheduleInput,
  validateSearchTerm,
  validateSettingInput,
  truncateResult,
} from "../validation";

describe("validateTicker", () => {
  it("accepts valid tickers", () => {
    expect(() => validateTicker("AAPL")).not.toThrow();
    expect(() => validateTicker("MSFT")).not.toThrow();
    expect(() => validateTicker("BRK.B")).not.toThrow();
    expect(() => validateTicker("^GSPC")).not.toThrow();
    expect(() => validateTicker("EUR=X")).not.toThrow();
    expect(() => validateTicker("BTC-USD")).not.toThrow();
    expect(() => validateTicker("A")).not.toThrow();
    expect(() => validateTicker("1234567890")).not.toThrow();
  });

  it("rejects empty ticker", () => {
    expect(() => validateTicker("")).toThrow("Ticker is required");
  });

  it("rejects tickers exceeding max length", () => {
    expect(() => validateTicker("ABCDEFGHIJK")).toThrow("at most 10 characters");
  });

  it("rejects lowercase letters", () => {
    expect(() => validateTicker("aapl")).toThrow("uppercase letters");
  });

  it("rejects special characters not in allowed set", () => {
    expect(() => validateTicker("AA@L")).toThrow("uppercase letters");
    expect(() => validateTicker("AA L")).toThrow("uppercase letters");
    expect(() => validateTicker("AA!L")).toThrow("uppercase letters");
    expect(() => validateTicker("AA/L")).toThrow("uppercase letters");
  });
});

describe("validateStringLength", () => {
  it("accepts strings within limit", () => {
    expect(() => validateStringLength("hello", "Test", 10)).not.toThrow();
    expect(() => validateStringLength("", "Test", 10)).not.toThrow();
    expect(() => validateStringLength("a".repeat(10), "Test", 10)).not.toThrow();
  });

  it("rejects strings exceeding limit", () => {
    expect(() => validateStringLength("a".repeat(11), "Field", 10)).toThrow(
      "Field must be at most 10 characters",
    );
  });
});

describe("validateStockInput", () => {
  it("validates a complete stock input", () => {
    expect(() =>
      validateStockInput({
        ticker: "AAPL",
        exchange: "NASDAQ",
        companyName: "Apple Inc.",
        sector: "Technology",
        notes: "Blue chip stock",
        tags: ["tech", "megacap"],
      }),
    ).not.toThrow();
  });

  it("accepts partial input (all fields optional)", () => {
    expect(() => validateStockInput({})).not.toThrow();
    expect(() => validateStockInput({ ticker: "MSFT" })).not.toThrow();
  });

  it("rejects too many tags", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    expect(() => validateStockInput({ tags })).toThrow("Maximum of 20 tags");
  });

  it("rejects tags that are too long", () => {
    expect(() =>
      validateStockInput({ tags: ["a".repeat(51)] }),
    ).toThrow("Tag must be at most 50 characters");
  });

  it("rejects company name that is too long", () => {
    expect(() =>
      validateStockInput({ companyName: "a".repeat(201) }),
    ).toThrow("Company name must be at most 200 characters");
  });

  it("rejects exchange that is too long", () => {
    expect(() =>
      validateStockInput({ exchange: "a".repeat(21) }),
    ).toThrow("Exchange must be at most 20 characters");
  });

  it("rejects sector that is too long", () => {
    expect(() =>
      validateStockInput({ sector: "a".repeat(101) }),
    ).toThrow("Sector must be at most 100 characters");
  });

  it("rejects notes that are too long", () => {
    expect(() =>
      validateStockInput({ notes: "a".repeat(5001) }),
    ).toThrow("Notes must be at most 5000 characters");
  });
});

describe("validatePromptInput", () => {
  it("accepts valid prompt input", () => {
    expect(() =>
      validatePromptInput({
        name: "Deep Analysis",
        description: "Comprehensive stock analysis",
        template: "Analyze {{TICKER}} in depth.",
      }),
    ).not.toThrow();
  });

  it("accepts partial input", () => {
    expect(() => validatePromptInput({})).not.toThrow();
  });

  it("rejects name that is too long", () => {
    expect(() =>
      validatePromptInput({ name: "a".repeat(201) }),
    ).toThrow("Prompt name must be at most 200 characters");
  });

  it("rejects description that is too long", () => {
    expect(() =>
      validatePromptInput({ description: "a".repeat(1001) }),
    ).toThrow("Prompt description must be at most 1000 characters");
  });

  it("rejects template that is too long", () => {
    expect(() =>
      validatePromptInput({ template: "a".repeat(50_001) }),
    ).toThrow("Prompt template must be at most 50000 characters");
  });
});

describe("validateScheduleInput", () => {
  it("accepts valid schedule input", () => {
    expect(() =>
      validateScheduleInput({
        name: "Daily Research",
        cron: "0 9 * * *",
        timezone: "America/New_York",
      }),
    ).not.toThrow();
  });

  it("accepts partial input", () => {
    expect(() => validateScheduleInput({})).not.toThrow();
  });

  it("rejects name that is too long", () => {
    expect(() =>
      validateScheduleInput({ name: "a".repeat(201) }),
    ).toThrow("Schedule name must be at most 200 characters");
  });

  it("rejects cron that is too long", () => {
    expect(() =>
      validateScheduleInput({ cron: "a".repeat(101) }),
    ).toThrow("Cron expression must be at most 100 characters");
  });

  it("rejects timezone that is too long", () => {
    expect(() =>
      validateScheduleInput({ timezone: "a".repeat(101) }),
    ).toThrow("Timezone must be at most 100 characters");
  });
});

describe("validateSearchTerm", () => {
  it("accepts valid search terms", () => {
    expect(() => validateSearchTerm("AAPL")).not.toThrow();
    expect(() => validateSearchTerm("")).not.toThrow();
    expect(() => validateSearchTerm("a".repeat(500))).not.toThrow();
  });

  it("rejects search terms that are too long", () => {
    expect(() => validateSearchTerm("a".repeat(501))).toThrow(
      "Search term must be at most 500 characters",
    );
  });
});

describe("validateSettingInput", () => {
  it("accepts valid setting input", () => {
    expect(() => validateSettingInput("openai_api_key", "sk-1234")).not.toThrow();
  });

  it("rejects key that is too long", () => {
    expect(() =>
      validateSettingInput("a".repeat(101), "value"),
    ).toThrow("Setting key must be at most 100 characters");
  });

  it("rejects value that is too long", () => {
    expect(() =>
      validateSettingInput("key", "a".repeat(10_001)),
    ).toThrow("Setting value must be at most 10000 characters");
  });
});

describe("truncateResult", () => {
  it("returns short results unchanged", () => {
    const result = "Short result";
    expect(truncateResult(result)).toBe(result);
  });

  it("returns result at exactly the limit unchanged", () => {
    const result = "a".repeat(500_000);
    expect(truncateResult(result)).toBe(result);
  });

  it("truncates results exceeding 500KB", () => {
    const result = "a".repeat(500_001);
    const truncated = truncateResult(result);
    // The original content is cut to 500K chars, then the suffix is appended
    expect(truncated).toContain("[Result truncated due to size limits]");
    // Should start with 500K 'a's (the truncated original content)
    expect(truncated.startsWith("a".repeat(500_000))).toBe(true);
    // The 'a' content should be exactly 500K (not 500_001)
    const aCount = truncated.split("[Result")[0]!.replace(/\n/g, "").length;
    expect(aCount).toBe(500_000);
  });
});
