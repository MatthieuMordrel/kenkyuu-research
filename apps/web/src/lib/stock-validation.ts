export interface StockFormData {
  ticker: string;
  companyName: string;
  exchange: string;
  sector?: string;
  notes?: string;
  tags: string[];
}

export interface StockFormErrors {
  ticker?: string;
  companyName?: string;
  exchange?: string;
}

const TICKER_PATTERN = /^[A-Z]{1,5}$/;

export function validateTicker(ticker: string): string | undefined {
  const trimmed = ticker.trim();
  if (!trimmed) {
    return "Ticker is required";
  }
  if (!TICKER_PATTERN.test(trimmed)) {
    return "Ticker must be 1-5 uppercase letters (e.g., AAPL)";
  }
  return undefined;
}

export function validateCompanyName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Company name is required";
  }
  return undefined;
}

export function validateExchange(exchange: string): string | undefined {
  const trimmed = exchange.trim();
  if (!trimmed) {
    return "Exchange is required";
  }
  return undefined;
}

export function validateStockForm(data: StockFormData): StockFormErrors {
  const errors: StockFormErrors = {};

  const tickerError = validateTicker(data.ticker);
  if (tickerError) errors.ticker = tickerError;

  const companyNameError = validateCompanyName(data.companyName);
  if (companyNameError) errors.companyName = companyNameError;

  const exchangeError = validateExchange(data.exchange);
  if (exchangeError) errors.exchange = exchangeError;

  return errors;
}

export function hasErrors(errors: StockFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}
