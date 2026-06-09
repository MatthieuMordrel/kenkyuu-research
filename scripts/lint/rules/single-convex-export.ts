/**
 * Enforces that Convex files contain only a single Convex function and no helpers.
 */
import { collectFiles } from "../shared/collectFiles";
import { countExportedFunctions } from "../shared/countExportedFunctions";
import { reportViolations } from "../shared/reportViolations";
import { CONVEX_PACKAGE_DIR } from "../shared/rootDir";

const CONVEX_FN_PATTERN = new RegExp(
  [
    /^export\s+const\s+\w+\s*=\s*(?:query|internalQuery|mutation|internalMutation|action|internalAction|httpAction)\s*\(/,
    /^(?:async\s+)?function\s+\w+/,
    /^const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-z]\w*)\s*=>/,
    /^const\s+\w+\s*=\s*(?:async\s+)?function\s*[(<]/,
  ]
    .map((rule) => `(?:${rule.source})`)
    .join("|"),
  "gm"
);

const files = await collectFiles(CONVEX_PACKAGE_DIR, {
  extensions: [".ts"],
  excludeDirs: ["_generated", "node_modules", "dist"],
  excludeFiles: ["*.test.ts"],
});

const violations = await countExportedFunctions(
  files,
  CONVEX_PACKAGE_DIR,
  CONVEX_FN_PATTERN
);

const ok = reportViolations(violations, {
  label: "Convex",
  hint: "Each file should contain only a Convex function (query, mutation, or action) with no helpers.\n  Check if the helper already exists in a lib/ folder before creating a new file.\n  If domain-specific, add it to a nearby lib/ subfolder. If generic, add it to a shared lib/ folder.",
});

if (!ok) {
  process.exit(1);
}
