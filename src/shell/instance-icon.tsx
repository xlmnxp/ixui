import { Box, Monitor, Play, RotateCw, Square, Snowflake, TriangleAlert } from "lucide-react";

const DOT: Record<string, string> = {
  Running: "bg-success",
  Started: "bg-success",
  Starting: "bg-blue-400",
  Stopped: "bg-text-tertiary",
  Stopping: "bg-warning",
  Restarting: "bg-blue-400",
  Freezing: "bg-blue-400",
  Frozen: "bg-blue-400",
  Paused: "bg-blue-400",
  Error: "bg-danger",
};

export function instanceDotClass(status: string): string {
  return DOT[status] ?? "bg-text-tertiary";
}

export interface InstanceIconProps {
  status: string;
  type: "container" | "virtual-machine";
}

export function InstanceIcon({ status, type }: InstanceIconProps) {
  const Icon = type === "virtual-machine" ? Monitor : Box;
  const isRunning = status === "Running" || status === "Started";
  return (
    <span className="relative inline-flex" data-testid="instance-icon">
      <Icon size={15} className="text-text-secondary" />
      {isRunning ? (
        <Play size={9} className="absolute -right-0.5 -top-0.5 text-success" fill="currentColor" />
      ) : (
        <span className={`absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-1 ring-sidebar ${
          instanceDotClass(status)
        }`} />
      )}
    </span>
  );
}

const STATUS_ICON: Record<string, { Icon: typeof Play; className: string }> = {
  Running: { Icon: Play, className: "text-success" },
  Started: { Icon: Play, className: "text-success" },
  Starting: { Icon: Play, className: "text-blue-400" },
  Stopped: { Icon: Square, className: "text-text-tertiary" },
  Stopping: { Icon: Square, className: "text-warning" },
  Restarting: { Icon: RotateCw, className: "text-blue-400" },
  Freezing: { Icon: Snowflake, className: "text-blue-400" },
  Frozen: { Icon: Snowflake, className: "text-blue-400" },
  Paused: { Icon: Snowflake, className: "text-blue-400" },
  Error: { Icon: TriangleAlert, className: "text-danger" },
};

export function InstanceStatusIcon({ status }: { status: string }) {
  const entry = STATUS_ICON[status] ?? { Icon: Square, className: "text-text-tertiary" };
  const { Icon, className } = entry;
  return <Icon size={16} className={className} data-testid="instance-status-icon" />;
}
