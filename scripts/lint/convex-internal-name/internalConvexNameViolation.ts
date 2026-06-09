/**
 * Describes one internal Convex export whose name does not use the `internal` prefix.
 *
 * @property filePath The absolute source-file path.
 * @property relativePath The repo-relative source-file path.
 * @property exportName The current exported Convex symbol.
 * @property suggestedExportName The normalized `internal*` symbol name.
 * @property currentBaseName The current filename without extension.
 * @property suggestedBaseName The filename stem that matches the normalized export.
 */
export interface InternalConvexNameViolation {
  filePath: string;
  relativePath: string;
  exportName: string;
  suggestedExportName: string;
  currentBaseName: string;
  suggestedBaseName: string;
}
