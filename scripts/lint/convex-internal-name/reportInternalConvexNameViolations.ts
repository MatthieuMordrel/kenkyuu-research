/**
 * Prints internal Convex export-name violations and returns whether the rule passed.
 */
import type { InternalConvexNameViolation } from "./internalConvexNameViolation";

/**
 * Reports internal Convex entry points whose names should be normalized.
 *
 * @param violations The detected naming violations.
 * @returns `true` when the rule passes.
 */
export function reportInternalConvexNameViolations(
  violations: InternalConvexNameViolation[]
): boolean {
  if (violations.length === 0) {
    process.stdout.write(
      "✅ Convex internal names: all internal queries, mutations, and actions start with internal.\n"
    );
    return true;
  }

  process.stderr.write(
    "\n❌ Convex internal names: internal entry point naming violation(s):\n\n"
  );

  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.relativePath} — exports ${violation.exportName}, expected ${violation.suggestedExportName}\n`
    );
  }

  process.stderr.write(
    "\n  Internal Convex queries, mutations, and actions must start with `internal`.\n  Rename the export AND the file (file name must match the export name), then update all `internal.*` references and rerun codegen.\n\n"
  );

  return false;
}
