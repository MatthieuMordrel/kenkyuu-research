/** Counts `###` headings in a markdown string. */
export const countH3 = (text: string | undefined) =>
  text?.match(/^### /gm)?.length ?? 0;
