/**
 * Finds internal Convex exports whose symbol names do not start with `internal`.
 */
import { readFile } from "node:fs/promises";
import { extname, relative, sep } from "node:path";
import { buildInternalConvexName } from "./buildInternalConvexName";
import type { InternalConvexNameViolation } from "./internalConvexNameViolation";

const INTERNAL_CONVEX_EXPORT_PATTERN =
  /^export\s+const\s+(\w+)\s*=\s*(internalQuery|internalMutation|internalAction)\s*\(/gm;

/**
 * Scans Convex source files for internal entry points whose exported name is
 * not prefixed with `internal`.
 *
 * @param files The absolute file paths to inspect.
 * @param rootDir The repo root directory used for relative reporting.
 * @returns The detected naming violations.
 */
export async function findInternalConvexNameViolations(
  files: string[],
  rootDir: string
): Promise<InternalConvexNameViolation[]> {
  const results = await Promise.all(
    files.map(async (filePath) => {
      const content = await readFile(filePath, "utf8");
      const match = [...content.matchAll(INTERNAL_CONVEX_EXPORT_PATTERN)][0];
      if (!match) {
        return null;
      }

      const exportName = match[1]!;
      const suggestedExportName = buildInternalConvexName(exportName);
      if (suggestedExportName === exportName) {
        return null;
      }

      const currentBaseName = filePath.slice(
        filePath.lastIndexOf(sep) + 1,
        filePath.length - extname(filePath).length
      );

      return {
        filePath,
        relativePath: relative(rootDir, filePath),
        exportName,
        suggestedExportName,
        currentBaseName,
        suggestedBaseName: suggestedExportName,
      };
    })
  );

  return results.filter(
    (violation): violation is InternalConvexNameViolation => violation !== null
  );
}
