"use node";

import Anthropic from "@anthropic-ai/sdk";
import type { TextBlock } from "@anthropic-ai/sdk/resources/messages";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  DEFAULT_FORMAT_MODEL_ID,
  estimateFormatCost,
  resolveFormatModel,
  type FormatModelDefinition,
} from "@repo/research-models/format-models";
import type { NormalizedUsage } from "@repo/research-models/types";
import {
  postpassResearchMarkdown,
  prepassResearchMarkdown,
  splitMarkdownForFormatting,
} from "./researchFormatPrepass";

const FORMAT_SYSTEM_PROMPT = `You are a publication-quality markdown editor for institutional equity research. The report renders in a web app where only ## headings become collapsible sections. Everything collapsed by default except the reader expands a few major parts — so structure must be disciplined.

## Outline rules (critical)

- Exactly ONE # title at the top (company / report name). Do not repeat the company name as ## later.
- Use ## only for major parts (about 6–12 for a long report): e.g. Executive summary, Investment thesis, Business model, Financials & KPIs, Competitive landscape, Risks, Valuation, Data verification (if needed), Sources.
- Do NOT use ## for: numbered stubs ("Section 1", "Section 2"), quarters (Q1 2026, Q4 2025), single months, one-line facts, or duplicate company titles.
- Use ### sparingly — only when a subsection has several paragraphs or a substantial bullet list beneath it.
- Dates, quarters, and short labels (Q1 2026, December 2025, End 2025) must be **bold lead-ins** or bullet items, NEVER ### or ## headings.
- Merge redundant blocks: one "Nebius Group" chapter with Section 1/2/3 content nested as ### or bold sub-parts under a single ##, not multiple duplicate ## company headers.
- Remove empty "Data verification" style headers unless they contain real content; fold verification notes into bullets under Financials.

## Readability

- NEVER leave "Label.** sentence" blobs — use **Label:** or ### Label (only if enough body text follows).
- Clusters of metrics → bullet lists. Verbatim quotes → blockquotes (> …).
- One idea per paragraph; fix hard line breaks and dangling em dashes.

## Example

BAD: ## Nebius Group / ## Data verification / ## Section 1 / ### Q1 2026 / ### December 2025 (one line each)
GOOD: ## Business model & unit economics with **Q1 2026:** and **FY2025:** as bold bullets inside the section

## Fidelity

- Keep all numbers, dates, tickers, and claims exact. Preserve citations and ## Sources.
- Output GitHub-flavored Markdown only — no preamble or wrapper fences.`;

const MIN_LENGTH_RATIO = 0.7;
const MAX_LENGTH_RATIO = 1.35;
const MAX_LINK_COUNT_DELTA = 5;
const MAX_FORMAT_ATTEMPTS = 2;

/** @deprecated Use prepassResearchMarkdown from researchFormatPrepass */
export function prepassMarkdown(markdown: string): string {
  return prepassResearchMarkdown(markdown);
}

/** Counts markdown links `[text](url)` for fidelity checks. */
export function countMarkdownLinks(markdown: string): number {
  const matches = markdown.match(/\[[^\]]*\]\([^)]+\)/g);
  return matches?.length ?? 0;
}

/**
 * Returns true when formatted output is plausibly the same report as raw.
 */
export function passesFormattingGuards(raw: string, formatted: string): boolean {
  const trimmed = formatted.trim();
  if (trimmed.length === 0) return false;

  const ratio = trimmed.length / Math.max(raw.length, 1);
  if (ratio < MIN_LENGTH_RATIO || ratio > MAX_LENGTH_RATIO) return false;

  const rawLinks = countMarkdownLinks(raw);
  const formattedLinks = countMarkdownLinks(formatted);
  if (Math.abs(formattedLinks - rawLinks) > MAX_LINK_COUNT_DELTA) {
    if (rawLinks > 0) {
      const relativeDelta = Math.abs(formattedLinks - rawLinks) / rawLinks;
      if (relativeDelta > 0.1) return false;
    } else if (formattedLinks > MAX_LINK_COUNT_DELTA) {
      return false;
    }
  }

  return true;
}

function extractAssistantText(content: readonly unknown[]): string {
  return content
    .filter((block): block is TextBlock => (block as { type?: string }).type === "text")
    .map((block) => block.text)
    .join("\n\n")
    .trim();
}

function maxOutputTokensForInput(inputLength: number): number {
  return Math.min(16_384, Math.max(4_096, Math.ceil(inputLength * 0.55) + 2_048));
}

function mergeUsage(
  total: NormalizedUsage,
  next: NormalizedUsage
): NormalizedUsage {
  return {
    inputTokens: total.inputTokens + next.inputTokens,
    outputTokens: total.outputTokens + next.outputTokens,
  };
}

/**
 * Calls the formatter model on one markdown chunk; throws on API or empty response errors.
 */
async function callFormatter(
  formatModel: FormatModelDefinition,
  apiKey: string,
  rawMarkdown: string
): Promise<{ text: string; usage: NormalizedUsage }> {
  const client = new Anthropic({ apiKey });
  const preprocessed = prepassResearchMarkdown(rawMarkdown);

  const stream = client.messages.stream({
    model: formatModel.apiModel,
    max_tokens: maxOutputTokensForInput(preprocessed.length),
    temperature: 0,
    system: FORMAT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Rewrite for readability. Use ONE # title, ~6-12 ## major sections only (no ## for quarters/dates/section numbers). Use **bold** for Q1 2026-style labels. No duplicate company ## headers. Preserve all facts exactly. Return only markdown.\n\n---\n\n${preprocessed}`,
      },
    ],
  });

  const response = await stream.finalMessage();
  const text = extractAssistantText(response.content);
  if (!text) {
    throw new Error("Formatter returned no text");
  }

  return {
    text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Formats one chunk (single API call, post-pass applied).
 */
async function formatChunk(
  formatModel: FormatModelDefinition,
  apiKey: string,
  chunk: string
): Promise<{ text: string; usage: NormalizedUsage }> {
  const { text, usage } = await callFormatter(formatModel, apiKey, chunk);
  return { text: postpassResearchMarkdown(text), usage };
}

/**
 * Runs the formatter with guardrails; falls back to preprocessed raw on failure.
 * Long reports are split by section to stay within action time limits.
 */
export async function formatResearchMarkdown(
  formatModel: FormatModelDefinition,
  apiKey: string,
  rawMarkdown: string
): Promise<{ text: string; usage: NormalizedUsage; usedFallback: boolean }> {
  const preprocessed = prepassResearchMarkdown(rawMarkdown);
  const chunks = splitMarkdownForFormatting(rawMarkdown);
  let usage: NormalizedUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    if (chunks.length === 1) {
      let lastText = preprocessed;
      for (let attempt = 0; attempt < MAX_FORMAT_ATTEMPTS; attempt++) {
        const formatted = await formatChunk(formatModel, apiKey, chunks[0]);
        usage = mergeUsage(usage, formatted.usage);
        lastText = formatted.text;
        if (passesFormattingGuards(preprocessed, lastText)) {
          return { text: lastText, usage, usedFallback: false };
        }
      }
      return {
        text: postpassResearchMarkdown(lastText),
        usage,
        usedFallback: true,
      };
    }

    const formattedParts: string[] = [];
    for (const chunk of chunks) {
      const formatted = await formatChunk(formatModel, apiKey, chunk);
      usage = mergeUsage(usage, formatted.usage);
      formattedParts.push(formatted.text);
    }

    const combined = postpassResearchMarkdown(formattedParts.join("\n\n"));
    if (passesFormattingGuards(preprocessed, combined)) {
      return { text: combined, usage, usedFallback: false };
    }

    return { text: combined, usage, usedFallback: true };
  } catch (error) {
    console.error(
      "formatResearchMarkdown failed:",
      error instanceof Error ? error.message : error
    );
    return { text: preprocessed, usage, usedFallback: true };
  }
}

async function getAnthropicApiKey(ctx: ActionCtx): Promise<string | null> {
  return await ctx.runQuery(internal.authHelpers.getSettingValue, {
    key: "anthropic_api_key",
  });
}

async function loadJob(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<Doc<"researchJobs"> | null> {
  return await ctx.runQuery(internal.researchJobs.getJobInternal, { id: jobId });
}

/**
 * Polishes raw research output and marks the job completed (new-job pipeline).
 */
export const formatResearchResult = internalAction({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args): Promise<void> => {
    const job = await loadJob(ctx, args.jobId);
    if (!job || job.status !== "formatting" || !job.rawResult) {
      return;
    }

    const apiKey = await getAnthropicApiKey(ctx);
    const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);
    const researchCostUsd = job.costUsd ?? 0;

    let resultText = job.rawResult;
    let formattingCostUsd = 0;

    if (apiKey) {
      try {
        const formatted = await formatResearchMarkdown(
          formatModel,
          apiKey,
          job.rawResult
        );
        resultText = formatted.text;
        formattingCostUsd = estimateFormatCost(formatModel, formatted.usage);

        if (!formatted.usedFallback && formattingCostUsd > 0) {
          await ctx.runMutation(internal.researchJobs.logCost, {
            jobId: job._id,
            provider: "anthropic",
            modelId: formatModel.id,
            costUsd: formattingCostUsd,
          });
        }
      } catch (error) {
        console.error(
          `formatResearchResult: formatter failed for ${args.jobId}:`,
          error instanceof Error ? error.message : error
        );
        resultText = prepassResearchMarkdown(job.rawResult);
      }
    } else {
      resultText = prepassMarkdown(job.rawResult);
    }

    await ctx.runMutation(internal.researchJobs.completeFormattedJob, {
      id: job._id,
      result: resultText,
      costUsd: researchCostUsd + formattingCostUsd,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.dispatchJobNotification,
      { jobId: job._id }
    );

    await ctx.scheduler.runAfter(0, internal.budgetAlert.checkBudgetAlert, {
      currentCostUsd: researchCostUsd + formattingCostUsd,
    });
  },
});

interface ReformatOutcome {
  jobId: string;
  usedFallback: boolean;
}

/**
 * Re-runs the formatting pass on a completed job (backfill). Keeps status completed.
 */
async function reformatCompletedJob(
  ctx: ActionCtx,
  jobId: Id<"researchJobs">
): Promise<ReformatOutcome> {
  const job = await loadJob(ctx, jobId);
  if (!job) {
    throw new Error("Research job not found");
  }
  if (job.status !== "completed" || !job.result) {
    throw new Error("Job must be completed with a result to reformat");
  }

  const source = job.rawResult ?? job.result;
  const apiKey = await getAnthropicApiKey(ctx);
  const formatModel = resolveFormatModel(DEFAULT_FORMAT_MODEL_ID);

  let resultText = prepassResearchMarkdown(source);
  let formattingCostUsd = 0;
  let usedFallback = true;

  if (apiKey) {
    const formatted = await formatResearchMarkdown(formatModel, apiKey, source);
    resultText = formatted.text;
    formattingCostUsd = estimateFormatCost(formatModel, formatted.usage);
    usedFallback = formatted.usedFallback;

    if (!usedFallback && formattingCostUsd > 0) {
      await ctx.runMutation(internal.researchJobs.logCost, {
        jobId: job._id,
        provider: "anthropic",
        modelId: formatModel.id,
        costUsd: formattingCostUsd,
      });
    }
  }

  await ctx.runMutation(internal.researchJobs.applyReformattedResult, {
    id: job._id,
    rawResult: job.rawResult ?? source,
    result: resultText,
    additionalCostUsd: formattingCostUsd,
  });

  return { jobId, usedFallback };
}

export const reformatResearchJob = internalAction({
  args: { jobId: v.id("researchJobs") },
  handler: async (ctx, args): Promise<ReformatOutcome> => {
    return await reformatCompletedJob(ctx, args.jobId);
  },
});

/**
 * Finds the latest completed research job for a stock ticker and reformats it.
 */
export const reformatByTicker = internalAction({
  args: { ticker: v.string() },
  handler: async (ctx, args): Promise<ReformatOutcome> => {
    const jobId = await ctx.runQuery(
      internal.researchJobs.findLatestCompletedJobByTicker,
      { ticker: args.ticker.toUpperCase() }
    );
    if (!jobId) {
      throw new Error(
        `No completed research job found for ticker ${args.ticker}`
      );
    }
    return await reformatCompletedJob(ctx, jobId);
  },
});
