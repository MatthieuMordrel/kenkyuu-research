/** Final path segment of a container file name (paths use forward slashes). */
export function basename(filename: string): string {
  return filename.split("/").at(-1) ?? filename;
}
