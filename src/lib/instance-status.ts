import type { BadgeTone } from "../components/badge";

const STATUS_TONES: Record<string, BadgeTone> = {
  Started: "success",
  Stopped: "neutral",
  Frozen: "info",
  Starting: "info",
  Stopping: "warning",
  Freezing: "info",
  Unfreezing: "info",
  Restarting: "info",
  Migrating: "warning",
  Error: "danger",
};

export function instanceStatusTone(status: string): BadgeTone {
  return STATUS_TONES[status] ?? "neutral";
}
