/**
 * Prints lint rule violations and returns whether the rule passed.
 */
import type { Violation } from "./countExportedFunctions";

/**
 * Display options for {@link reportViolations}.
 *
 * @property label Rule label shown in the pass/fail line.
 * @property hint Remediation guidance appended after the violation list.
 */
interface ReportOptions {
  label: string;
  hint: string;
}

/** Writes the violation report to stdout/stderr; returns true when clean. */
export function reportViolations(
  violations: Violation[],
  opts: ReportOptions
): boolean {
  if (violations.length === 0) {
    process.stdout.write(
      `✅ ${opts.label}: all files export at most one function.\n`
    );
    return true;
  }

  process.stderr.write(
    `\n❌ ${opts.label}: single export per file violation(s):\n\n`
  );

  for (const { file, count, matches } of violations) {
    process.stderr.write(`  ${file} — ${count} exports:\n`);
    for (const match of matches) {
      process.stderr.write(`    → ${match}\n`);
    }
  }

  process.stderr.write(`\n  ${opts.hint}\n\n`);
  return false;
}
