import { Box, Monitor, Play, Square, Snowflake, TriangleAlert } from "lucide-react";

const DOT: Record<string, string> = {
  Running: "bg-success",
  Started: "bg-success",
  Stopped: "bg-text-tertiary",
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
  return (
    <span className="relative inline-flex" data-testid="instance-icon">
      <Icon size={15} className="text-text-secondary" />
      <span className={`absolute -right-1 -top-0.5 h-2 w-2 rounded-full ${instanceDotClass(status)}`} />
    </span>
  );
}

const STATUS_ICON: Record<string, { Icon: typeof Play; className: string }> = {
  Running: { Icon: Play, className: "text-success" },
  Started: { Icon: Play, className: "text-success" },
  Stopped: { Icon: Square, className: "text-text-tertiary" },
  Frozen: { Icon: Snowflake, className: "text-blue-400" },
  Paused: { Icon: Snowflake, className: "text-blue-400" },
  Error: { Icon: TriangleAlert, className: "text-danger" },
};

export function InstanceStatusIcon({ status }: { status: string }) {
  const entry = STATUS_ICON[status] ?? { Icon: Square, className: "text-text-tertiary" };
  const { Icon, className } = entry;
  return <Icon size={16} className={className} data-testid="instance-status-icon" />;
}
