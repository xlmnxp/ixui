import type { Operation } from "../api/types";

/**
 * Percentage reported by the daemon for an operation, when it reports one.
 *
 * Image downloads publish `metadata.download_progress` as a string like "42%".
 * Anything without a numeric percentage returns undefined so the UI can show an
 * indeterminate bar instead of inventing progress.
 */
export function operationProgress(operation: Operation): number | undefined {
  const metadata = operation.metadata;
  if (!metadata) return undefined;
  for (const key of ["download_progress", "progress"]) {
    const raw = metadata[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.min(100, Math.max(0, Math.round(raw)));
    }
    if (typeof raw === "string") {
      const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
      if (match) return Math.min(100, Math.max(0, Math.round(parseFloat(match[1]!))));
    }
  }
  return undefined;
}

/** True when the operation is still running (not terminal). */
export function isOperationRunning(operation: Operation): boolean {
  return operation.status_code < 200 && !["Success", "Failure", "Cancelled"].includes(operation.status);
}
