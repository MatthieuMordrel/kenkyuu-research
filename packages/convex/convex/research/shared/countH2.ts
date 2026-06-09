/** Counts `##` headings in a markdown string. */
export const countH2 = (text: string | undefined) =>
  text?.match(/^## /gm)?.length ?? 0;
