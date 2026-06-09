/**
 * Enforces that internal Convex entry points use an `internal*` export name.
 */
import { findInternalConvexNameViolations } from "../convex-internal-name/findInternalConvexNameViolations";
import { reportInternalConvexNameViolations } from "../convex-internal-name/reportInternalConvexNameViolations";
import { collectFiles } from "../shared/collectFiles";
import { CONVEX_PACKAGE_DIR, REPO_ROOT } from "../shared/rootDir";

const files = await collectFiles(CONVEX_PACKAGE_DIR, {
  extensions: [".ts"],
  excludeDirs: ["_generated", "node_modules", "dist"],
  excludeFiles: ["*.test.ts"],
});

const violations = await findInternalConvexNameViolations(files, REPO_ROOT);
const ok = reportInternalConvexNameViolations(violations);

if (!ok) {
  process.exit(1);
}
