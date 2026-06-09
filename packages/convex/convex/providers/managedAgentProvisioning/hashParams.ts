"use node";

import { createHash } from "node:crypto";

/** Stable short hash of desired agent params, used to detect config drift. */
export function hashParams(params: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 32);
}
