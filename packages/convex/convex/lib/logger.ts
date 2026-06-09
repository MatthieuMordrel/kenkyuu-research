// oxlint-disable no-console -- centralized logger; console is Convex's logging transport
/**
 * Centralized logger for Convex functions.
 *
 * In Convex, `console.*` IS the logging transport: output shows up in the
 * Convex dashboard logs. All operational logging should go through this
 * helper so console usage stays confined to a single audited file.
 */
export const logger = {
  /** Log an informational, operational message (visible in the Convex dashboard). */
  info(...args: unknown[]): void {
    console.info(...args);
  },
  /** Log a recoverable or noteworthy condition. */
  warn(...args: unknown[]): void {
    console.warn(...args);
  },
  /** Log an error condition. */
  error(...args: unknown[]): void {
    console.error(...args);
  },
};
