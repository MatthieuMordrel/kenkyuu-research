/**
 * Recursively collects files matching the given extensions.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Options for {@link collectFiles}.
 *
 * @property extensions File suffixes to include (e.g. `[".ts"]`).
 * @property excludeDirs Directory names to skip entirely.
 * @property excludeFiles File names to skip; a leading `*` makes it a suffix match.
 */
interface CollectFilesOptions {
  extensions: string[];
  excludeDirs?: string[];
  excludeFiles?: string[];
}

/** Walks `dir` recursively and returns all file paths matching the options. */
export async function collectFiles(
  dir: string,
  opts: CollectFilesOptions
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const excludeDirs = new Set(opts.excludeDirs ?? []);
  const files: string[] = [];
  const subdirPromises: Promise<string[]>[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!excludeDirs.has(entry.name)) {
        subdirPromises.push(collectFiles(fullPath, opts));
      }
      continue;
    }

    const matchesExtension = opts.extensions.some((ext) =>
      entry.name.endsWith(ext)
    );
    if (!matchesExtension) {
      continue;
    }

    const isExcluded = (opts.excludeFiles ?? []).some((pattern) =>
      pattern.startsWith("*")
        ? entry.name.endsWith(pattern.slice(1))
        : entry.name === pattern
    );
    if (!isExcluded) {
      files.push(fullPath);
    }
  }

  const subdirResults = await Promise.all(subdirPromises);
  return files.concat(...subdirResults);
}
