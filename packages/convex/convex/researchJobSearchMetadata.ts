import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Denormalized metadata fields used to build the research job search index.
 * @property promptName - Prompt template display name at job creation time
 * @property stockTickers - Linked stock tickers
 * @property stockNames - Linked company names
 * @property title - Report title extracted from the formatted markdown H1
 */
export interface ResearchJobSearchMetadataParts {
  promptName: string;
  stockTickers: readonly string[];
  stockNames: readonly string[];
  title?: string;
}

/**
 * Extracts the primary report title from formatted markdown (first ATX H1).
 */
export function extractResearchTitle(markdown: string): string | undefined {
  // Titles are always the first H1; scan only the head to avoid parsing huge reports.
  const head = markdown.slice(0, 512);
  const match = head.match(/^#\s+(.+?)\s*$/m);
  const title = match?.[1]?.trim();
  return title && title.length > 0 ? title : undefined;
}

/**
 * Builds a compact search string from job metadata only (no report body or prompt template).
 */
export function buildResearchJobSearchText(
  parts: ResearchJobSearchMetadataParts
): string {
  const tokens = [
    parts.promptName,
    ...parts.stockTickers,
    ...parts.stockNames,
    parts.title,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));

  return tokens.join(" ");
}

/**
 * Loads prompt and stock metadata for a job and optionally derives the title from markdown.
 */
export async function resolveResearchJobSearchParts(
  ctx: QueryCtx | MutationCtx,
  args: {
    promptId: Id<"prompts">;
    stockIds: Id<"stocks">[];
    title?: string;
    resultMarkdown?: string;
  }
): Promise<ResearchJobSearchMetadataParts> {
  const prompt = await ctx.db.get(args.promptId);
  const stockDocs = await Promise.all(
    args.stockIds.map((stockId) => ctx.db.get(stockId))
  );
  const stocks = stockDocs.filter(
    (stock): stock is NonNullable<typeof stock> => stock !== null
  );

  const title =
    args.title ??
    (args.resultMarkdown
      ? extractResearchTitle(args.resultMarkdown)
      : undefined);

  return {
    promptName: prompt?.name ?? "",
    stockTickers: stocks.map((stock) => stock.ticker),
    stockNames: stocks.map((stock) => stock.companyName),
    title,
  };
}

/**
 * Resolves metadata parts and returns the indexed search string plus optional title.
 */
export async function buildSearchTextForJob(
  ctx: QueryCtx | MutationCtx,
  args: {
    promptId: Id<"prompts">;
    stockIds: Id<"stocks">[];
    title?: string;
    resultMarkdown?: string;
  }
): Promise<{ searchText: string; title?: string }> {
  const parts = await resolveResearchJobSearchParts(ctx, args);
  return {
    searchText: buildResearchJobSearchText(parts),
    title: parts.title,
  };
}
