/**
 * Counts exported functions per file using a regex pattern.
 */
import { readFile } from "node:fs/promises";
import { relative } from "node:path";

/**
 * A single file that breaks the one-function-per-file rule.
 *
 * @property file Path relative to the scanned root directory.
 * @property count Number of matched function definitions in the file.
 * @property matches The matched definition lines (trimmed).
 */
export interface Violation {
  file: string;
  count: number;
  matches: string[];
}

/** Returns a {@link Violation} for every file with more than one match of `pattern`. */
export async function countExportedFunctions(
  files: string[],
  rootDir: string,
  pattern: RegExp
): Promise<Violation[]> {
  const results = await Promise.all(
    files.map(async (filePath) => {
      const content = await readFile(filePath, "utf8");
      const matches = content.match(pattern);

      if (!matches || matches.length <= 1) {
        return null;
      }

      return {
        file: relative(rootDir, filePath),
        count: matches.length,
        matches: matches.map((match) => match.trim()),
      };
    })
  );

  return results.filter(
    (violation): violation is Violation => violation !== null
  );
}
