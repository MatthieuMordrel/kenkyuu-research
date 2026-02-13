/**
 * Shared input validation helpers for Convex mutations.
 * Enforces length limits and character restrictions on user-provided strings.
 */

// --- Length Limits ---

const MAX_TICKER_LENGTH = 10;
const MAX_EXCHANGE_LENGTH = 20;
const MAX_COMPANY_NAME_LENGTH = 200;
const MAX_SECTOR_LENGTH = 100;
const MAX_NOTES_LENGTH = 5000;
const MAX_TAG_LENGTH = 50;
const MAX_TAGS_COUNT = 20;

const MAX_PROMPT_NAME_LENGTH = 200;
const MAX_PROMPT_DESCRIPTION_LENGTH = 1000;
const MAX_PROMPT_TEMPLATE_LENGTH = 50_000;

const MAX_SCHEDULE_NAME_LENGTH = 200;
const MAX_CRON_LENGTH = 100;
const MAX_TIMEZONE_LENGTH = 100;

const MAX_SEARCH_TERM_LENGTH = 500;

const MAX_SETTING_KEY_LENGTH = 100;
const MAX_SETTING_VALUE_LENGTH = 10_000;

const MAX_RESULT_SIZE = 500_000; // 500KB limit for research job results

// --- Ticker Validation ---

const TICKER_REGEX = /^[A-Z0-9.^=-]{1,10}$/;

export function validateTicker(ticker: string): void {
  if (ticker.length === 0) {
    throw new Error("Ticker is required");
  }
  if (ticker.length > MAX_TICKER_LENGTH) {
    throw new Error(`Ticker must be at most ${MAX_TICKER_LENGTH} characters`);
  }
  if (!TICKER_REGEX.test(ticker)) {
    throw new Error(
      "Ticker must contain only uppercase letters, digits, and . ^ = - characters",
    );
  }
}

// --- Generic String Validation ---

export function validateStringLength(
  value: string,
  fieldName: string,
  maxLength: number,
): void {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }
}

// --- Stock Validation ---

export function validateStockInput(args: {
  ticker?: string;
  exchange?: string;
  companyName?: string;
  sector?: string;
  notes?: string;
  tags?: string[];
}): void {
  if (args.ticker !== undefined) validateTicker(args.ticker);
  if (args.exchange !== undefined)
    validateStringLength(args.exchange, "Exchange", MAX_EXCHANGE_LENGTH);
  if (args.companyName !== undefined)
    validateStringLength(
      args.companyName,
      "Company name",
      MAX_COMPANY_NAME_LENGTH,
    );
  if (args.sector !== undefined)
    validateStringLength(args.sector, "Sector", MAX_SECTOR_LENGTH);
  if (args.notes !== undefined)
    validateStringLength(args.notes, "Notes", MAX_NOTES_LENGTH);
  if (args.tags !== undefined) {
    if (args.tags.length > MAX_TAGS_COUNT) {
      throw new Error(`Maximum of ${MAX_TAGS_COUNT} tags allowed`);
    }
    for (const tag of args.tags) {
      validateStringLength(tag, "Tag", MAX_TAG_LENGTH);
    }
  }
}

// --- Prompt Validation ---

export function validatePromptInput(args: {
  name?: string;
  description?: string;
  template?: string;
}): void {
  if (args.name !== undefined)
    validateStringLength(args.name, "Prompt name", MAX_PROMPT_NAME_LENGTH);
  if (args.description !== undefined)
    validateStringLength(
      args.description,
      "Prompt description",
      MAX_PROMPT_DESCRIPTION_LENGTH,
    );
  if (args.template !== undefined)
    validateStringLength(
      args.template,
      "Prompt template",
      MAX_PROMPT_TEMPLATE_LENGTH,
    );
}

// --- Schedule Validation ---

export function validateScheduleInput(args: {
  name?: string;
  cron?: string;
  timezone?: string;
}): void {
  if (args.name !== undefined)
    validateStringLength(args.name, "Schedule name", MAX_SCHEDULE_NAME_LENGTH);
  if (args.cron !== undefined)
    validateStringLength(args.cron, "Cron expression", MAX_CRON_LENGTH);
  if (args.timezone !== undefined)
    validateStringLength(args.timezone, "Timezone", MAX_TIMEZONE_LENGTH);
}

// --- Search Validation ---

export function validateSearchTerm(term: string): void {
  validateStringLength(term, "Search term", MAX_SEARCH_TERM_LENGTH);
}

// --- Settings Validation ---

export function validateSettingInput(key: string, value: string): void {
  validateStringLength(key, "Setting key", MAX_SETTING_KEY_LENGTH);
  validateStringLength(value, "Setting value", MAX_SETTING_VALUE_LENGTH);
}

// --- Research Result Size ---

export function truncateResult(result: string): string {
  if (result.length > MAX_RESULT_SIZE) {
    return result.slice(0, MAX_RESULT_SIZE) + "\n\n[Result truncated due to size limits]";
  }
  return result;
}
