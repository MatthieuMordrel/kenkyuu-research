/**
 * Variable injection preview for prompt templates.
 *
 * Replaces {{STOCKS}}, {{TICKER}}, and {{DATE}} with sample data
 * so users can preview how a prompt will look before execution.
 */

const SAMPLE_TICKER = "AAPL";

const SAMPLE_STOCKS = "AAPL, MSFT, GOOGL, AMZN, NVDA";

function getSampleDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface PromptVariable {
  name: string;
  pattern: string;
  description: string;
  sampleValue: string;
}

export function getPromptVariables(): PromptVariable[] {
  return [
    {
      name: "TICKER",
      pattern: "{{TICKER}}",
      description: "A single stock ticker symbol",
      sampleValue: SAMPLE_TICKER,
    },
    {
      name: "STOCKS",
      pattern: "{{STOCKS}}",
      description: "A comma-separated list of stock ticker symbols",
      sampleValue: SAMPLE_STOCKS,
    },
    {
      name: "DATE",
      pattern: "{{DATE}}",
      description: "The current date",
      sampleValue: getSampleDate(),
    },
  ];
}

export interface InjectVariablesOptions {
  ticker?: string;
  stocks?: string;
  date?: string;
}

/**
 * Injects variable values into a prompt template.
 * Falls back to sample data for any variable not provided.
 */
export function injectVariables(
  template: string,
  options: InjectVariablesOptions = {},
): string {
  const { ticker, stocks, date } = options;

  let result = template;
  result = result.replaceAll("{{TICKER}}", ticker ?? SAMPLE_TICKER);
  result = result.replaceAll("{{STOCKS}}", stocks ?? SAMPLE_STOCKS);
  result = result.replaceAll("{{DATE}}", date ?? getSampleDate());

  return result;
}

/**
 * Extracts all variable placeholders found in a template string.
 * Returns the unique variable names (e.g., ["TICKER", "DATE"]).
 */
export function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const variables = new Set<string>();
  for (const match of matches) {
    variables.add(match[1]);
  }
  return [...variables];
}
