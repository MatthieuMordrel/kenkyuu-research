import { describe, it, expect } from "vitest";
import { mapFinnhubExchange } from "../lib/finnhub/mapExchange";

describe("mapFinnhubExchange", () => {
  it("maps US exchanges", () => {
    expect(
      mapFinnhubExchange("NASDAQ NMS - GLOBAL MARKET")
    ).toBe("NASDAQ");
    expect(mapFinnhubExchange("NEW YORK STOCK EXCHANGE, INC.")).toBe("NYSE");
  });

  it("maps international exchanges", () => {
    expect(mapFinnhubExchange("London Stock Exchange")).toBe("LSE");
    expect(mapFinnhubExchange("Tokyo Stock Exchange")).toBe("TSE");
    expect(mapFinnhubExchange("Hong Kong Exchanges And Clearing Ltd")).toBe(
      "HKEX"
    );
    expect(mapFinnhubExchange("Euronext Paris")).toBe("Euronext");
    expect(mapFinnhubExchange("Shanghai Stock Exchange")).toBe("SSE");
    expect(mapFinnhubExchange("Shenzhen Stock Exchange")).toBe("SZSE");
  });

  it("maps Asia-Pacific exchanges including Korea and Taiwan", () => {
    expect(mapFinnhubExchange("Korea Exchange")).toBe("KRX");
    expect(mapFinnhubExchange("KOSDAQ")).toBe("KRX");
    expect(mapFinnhubExchange("Taiwan Stock Exchange")).toBe("TWSE");
    expect(mapFinnhubExchange("TWSE")).toBe("TWSE");
    expect(mapFinnhubExchange("Singapore Exchange")).toBe("SGX");
  });

  it("returns null for unknown exchanges", () => {
    expect(mapFinnhubExchange("Some Other Market")).toBeNull();
    expect(mapFinnhubExchange("")).toBeNull();
    expect(mapFinnhubExchange(undefined)).toBeNull();
  });
});
