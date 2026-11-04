import type { Operation } from "../api/types";
import { formatBytes } from "./format";

interface ProgressInfo {
  percent?: number;
  /** Human-readable description of the current stage. */
  text?: string;
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, Math.round(value)));

/** Byte count from a number or a numeric string (the daemon sends strings). */
function toBytes(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

/** Every "NN%" occurrence in a daemon progress string, as numbers. */
function percentagesIn(text: string): number[] {
  return [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => parseFloat(match[1]!.replace(",", ".")))
    .filter((value) => Number.isFinite(value));
}

function humanizeStage(stage: string): string {
  const words = stage.replace(/_/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : stage;
}

/**
 * Progress reported by the daemon for an operation.
 *
 * The daemon uses two shapes, and both are handled here:
 *
 *   metadata:
 *     download_progress: 'rootfs: 46% (7.76MB/s)'
 *     create_instance_from_image_unpack_progress: 'Unpacking image: 100%'
 *     progress:
 *       percent: "100"
 *       speed: "0"
 *       stage: create_instance_from_image_unpack
 *
 * Keys ending in `_progress` persist across stages, so the lowest percentage
 * wins — that is the least-advanced part of the work still in flight.
 */
export function operationProgressInfo(operation: Operation): ProgressInfo {
  const metadata = operation.metadata;
  if (!metadata) return {};

  let percent: number | undefined;
  let stageText: string | undefined;
  let structuredText: string | undefined;

  // Structured form: { percent, speed, stage }.
  const structured = metadata.progress;
  if (structured && typeof structured === "object") {
    const record = structured as Record<string, unknown>;
    const rawPercent = record.percent;
    if (typeof rawPercent === "number" && Number.isFinite(rawPercent)) percent = clampPercent(rawPercent);
    if (typeof rawPercent === "string") {
      const parsed = parseFloat(rawPercent.replace(",", "."));
      if (Number.isFinite(parsed)) percent = clampPercent(parsed);
    }
    if (typeof record.stage === "string" && record.stage.trim()) {
      structuredText = humanizeStage(record.stage.trim());
    }
  } else if (typeof structured === "number" && Number.isFinite(structured)) {
    percent = clampPercent(structured);
  } else if (typeof structured === "string") {
    const values = percentagesIn(structured);
    if (values.length > 0) percent = clampPercent(Math.min(...values));
  }

  // Flat per-stage strings, e.g. download_progress or
  // create_instance_from_image_unpack_progress ("Unpacking image", sometimes
  // with a percentage, sometimes without while the stage is still working).
  for (const [key, value] of Object.entries(metadata)) {
    if (key !== "progress" && !key.endsWith("_progress")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const label = value.trim();
    const values = percentagesIn(label);
    if (values.length === 0) {
      // Descriptive only — this is what to say while the stage has no numbers.
      stageText = label;
      continue;
    }
    const lowest = clampPercent(Math.min(...values));
    if (percent === undefined || lowest < percent) percent = lowest;
    // The string that owns the currently-reported stage is the best label.
    if (lowest <= percent) stageText = label;
  }

  // Image pulls (POST /1.0/images) publish no progress at all — only the
  // resolved fingerprint and size — so describe what is being downloaded.
  if (!stageText && !structuredText) {
    const size = toBytes(metadata.size);
    const fingerprint = typeof metadata.fingerprint === "string" ? metadata.fingerprint : undefined;
    if (size !== undefined) {
      stageText = `Downloading ${formatBytes(size)}${fingerprint ? ` · ${fingerprint.slice(0, 12)}` : ""}`;
    } else if (fingerprint) {
      stageText = fingerprint.slice(0, 12);
    }
  }

  return { percent, text: stageText ?? structuredText };
}

/** Percentage reported by the daemon, when it reports one. */
export function operationProgress(operation: Operation): number | undefined {
  return operationProgressInfo(operation).percent;
}

/** What the operation is doing right now, e.g. "rootfs: 46% (7.76MB/s)". */
export function operationProgressText(operation: Operation): string | undefined {
  return operationProgressInfo(operation).text;
}

/** True when the operation is still running (not terminal). */
export function isOperationRunning(operation: Operation): boolean {
  return operation.status_code < 200 && !["Success", "Failure", "Cancelled"].includes(operation.status);
}
