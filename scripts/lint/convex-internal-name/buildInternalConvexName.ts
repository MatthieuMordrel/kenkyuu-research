/**
 * Normalizes an internal Convex export name so it starts with `internal`.
 *
 * Existing trailing `Internal` suffixes are moved to the front to preserve the
 * original semantic name while aligning with the repo convention.
 *
 * @param exportName The current exported symbol name.
 * @returns The normalized `internal*` symbol name.
 */
export function buildInternalConvexName(exportName: string): string {
  const internalSuffix = "Internal";
  const trimmedName = exportName.replace(/^_+/, "");
  const withoutSuffix = trimmedName.endsWith(internalSuffix)
    ? trimmedName.slice(0, -internalSuffix.length)
    : trimmedName;
  const suffixlessBody = withoutSuffix.startsWith("internal")
    ? withoutSuffix.slice("internal".length)
    : withoutSuffix;

  if (suffixlessBody.length === 0) {
    return "internal";
  }

  return `internal${suffixlessBody[0]!.toUpperCase()}${suffixlessBody.slice(1)}`;
}
