import { internalMutation } from "./_generated/server";

const SENIOR_EQUITY_RESEARCH_SCREEN_TEMPLATE = `You are a senior equity research analyst at a top-tier investment bank. Conduct a comprehensive stock screening and discovery analysis as of {{DATE}}.

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
5. Appendix with screening methodology details`;

const BUILT_IN_PROMPTS = [
  {
    name: "Senior Equity Research Screen",
    description:
      "Institutional-grade stock screening and discovery analysis. Identifies top investment opportunities using quantitative filters and fundamental deep dives.",
    type: "discovery" as const,
    template: SENIOR_EQUITY_RESEARCH_SCREEN_TEMPLATE,
    defaultProvider: "openai" as const,
    isBuiltIn: true,
  },
];

/**
 * One-off backfill: for every completed researchJob that has a costUsd but no
 * matching costLogs entry, insert the missing cost log row.
 * Run via: npx convex run seed:backfillCostLogs
 */
export const backfillCostLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const completedJobs = await ctx.db
      .query("researchJobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    let inserted = 0;
    let skipped = 0;

    for (const job of completedJobs) {
      if (job.costUsd === undefined) {
        skipped++;
        continue;
      }

      // Check if a cost log already exists for this job
      const existing = await ctx.db
        .query("costLogs")
        .withIndex("by_jobId", (q) => q.eq("jobId", job._id))
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await ctx.db.insert("costLogs", {
        jobId: job._id,
        provider: "openai",
        costUsd: job.costUsd,
        timestamp: job.completedAt ?? job.createdAt,
      });
      inserted++;
    }

    return { inserted, skipped };
  },
});

export const seedPrompts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("prompts").collect();
    const existingNames = new Set(existing.map((p) => p.name));

    let inserted = 0;
    const now = Date.now();

    for (const prompt of BUILT_IN_PROMPTS) {
      if (!existingNames.has(prompt.name)) {
        await ctx.db.insert("prompts", {
          ...prompt,
          createdAt: now,
          updatedAt: now,
        });
        inserted++;
      }
    }

    return { inserted, skipped: BUILT_IN_PROMPTS.length - inserted };
  },
});
