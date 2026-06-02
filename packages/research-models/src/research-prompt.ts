import { RESEARCH_PROVIDERS } from "./providers";

/**
 * Shared first-pass research system prompt for all providers.
 * OpenAI sends this as Responses API `instructions`; Anthropic as `system`.
 */
export const RESEARCH_SYSTEM_PROMPT = `Return valid GitHub-flavored Markdown.

Research rules:
- Prioritize primary sources, company filings, official statements, regulators, and reputable financial reporting.
- Include specific figures, dates, and named evidence wherever available.
- Surface the strongest bull case, bear case, catalysts, and the main unresolved uncertainties.
- If evidence is mixed or incomplete, say so explicitly instead of smoothing over it.`;

/** Built-in discovery prompt seeded on first deploy; editable on the Prompts page. */
export const BUILT_IN_DISCOVERY_PROMPT = {
  name: "Senior Equity Research Screen",
  description:
    "Institutional-grade stock screening and discovery analysis. Identifies top investment opportunities using quantitative filters and fundamental deep dives.",
  type: "discovery" as const,
  template: `You are a senior equity research analyst at a top-tier investment bank. Conduct a comprehensive stock screening and discovery analysis as of {{DATE}}.

## Objective
Identify the most promising investment opportunities across global equity markets using institutional-grade analysis frameworks.

## Analysis Framework

### 1. Market Regime Assessment
- Current macro environment (growth, inflation, rates, liquidity)
- Sector rotation signals and momentum shifts
- Risk appetite indicators (VIX, credit spreads, safe haven flows)

### 2. Quantitative Screening Criteria
Apply the following filters to identify candidates:
- **Valuation**: Forward P/E below sector median, PEG ratio < 1.5
- **Growth**: Revenue growth > 10% YoY, EPS growth acceleration
- **Quality**: ROE > 15%, FCF yield > 4%, debt/equity < 1.0
- **Momentum**: Relative strength vs sector > 0, positive earnings revision trend
- **Sentiment**: Analyst upgrades > downgrades in last 90 days

### 3. Fundamental Deep Dive (Top 5 Candidates)
For each top candidate provide:
- **Business overview**: What the company does, competitive moat, TAM
- **Financial analysis**: Revenue trajectory, margin expansion/compression, balance sheet health
- **Catalyst identification**: Upcoming events, product launches, regulatory changes
- **Risk assessment**: Key risks, bear case scenario, downside estimate
- **Valuation**: DCF-implied upside, comparable company analysis, historical range

### 4. Portfolio Construction Considerations
- Sector diversification recommendations
- Position sizing guidance based on conviction level
- Suggested entry points and stop-loss levels
- Time horizon for each recommendation (short/medium/long term)

## Output Format
Present findings in a structured report with:
1. Executive summary (top 3 picks with one-line thesis)
2. Market overview section
3. Individual stock profiles (ranked by conviction)
4. Risk matrix
5. Appendix with screening methodology details`,
};

/**
 * How a research provider delivers the job prompt to the model.
 * @property providerId - Registry id
 * @property providerLabel - Display name
 * @property deliveryNote - Short explanation shown in settings
 */
export interface ResearchProviderPromptView {
  providerId: keyof typeof RESEARCH_PROVIDERS;
  providerLabel: string;
  deliveryNote: string;
}

/**
 * Read-only snapshot of the first-pass research prompt layers for settings UI.
 * @property systemPrompt - Fixed system/instructions layer sent on every research job
 * @property providers - Per-vendor delivery of system prompt + user template
 * @property builtInDiscoveryName - Seeded built-in prompt title
 * @property builtInDiscoveryDescription - Seeded built-in prompt summary
 * @property builtInDiscoveryTemplate - Default template body (also user-editable in Prompts)
 */
export interface ResearchPromptView {
  systemPrompt: string;
  providers: ResearchProviderPromptView[];
  builtInDiscoveryName: string;
  builtInDiscoveryDescription: string;
  builtInDiscoveryTemplate: string;
}

/**
 * Returns provider and built-in prompt metadata for the settings research section.
 */
export function getResearchPromptView(): ResearchPromptView {
  return {
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
    providers: [
      {
        providerId: "openai",
        providerLabel: RESEARCH_PROVIDERS.openai.label,
        deliveryNote:
          "OpenAI receives the system prompt as instructions plus your selected prompt template as input.",
      },
      {
        providerId: "anthropic",
        providerLabel: RESEARCH_PROVIDERS.anthropic.label,
        deliveryNote:
          "Anthropic receives the system prompt plus your selected prompt template as the user message.",
      },
    ],
    builtInDiscoveryName: BUILT_IN_DISCOVERY_PROMPT.name,
    builtInDiscoveryDescription: BUILT_IN_DISCOVERY_PROMPT.description,
    builtInDiscoveryTemplate: BUILT_IN_DISCOVERY_PROMPT.template,
  };
}
