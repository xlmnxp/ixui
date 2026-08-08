import { useEffect, useState } from "react";
import { instancesApi } from "../api";
import type { Instance, InstanceStateInfo } from "../api/types";
import { Badge } from "../components/badge";
import { instanceStatusTone } from "../lib/instance-status";

export interface OverviewTabProps {
  instance: Instance;
}

export function OverviewTab({ instance }: OverviewTabProps) {
  const [state, setState] = useState<InstanceStateInfo | null>(null);

  useEffect(() => {
    void instancesApi.state(instance.name).then(setState).catch(() => setState(null));
  }, [instance.name]);

  const ips = state?.network
    ? Object.values(state.network).flatMap((iface) => iface.addresses.filter((a) => a.family === "inet").map((a) => a.address))
    : [];

  return (
    <div className="space-y-4" data-testid="overview-tab">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Detail label="Status"><Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge></Detail>
        <Detail label="Type">{instance.type === "container" ? "Container" : "Virtual machine"}</Detail>
        <Detail label="Created">{new Date(instance.created_at).toLocaleString()}</Detail>
        <Detail label="Last used">{instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never"}</Detail>
        <Detail label="Profiles">{instance.profiles.join(", ") || "—"}</Detail>
        <Detail label="IP addresses">{ips.length > 0 ? ips.join(", ") : "—"}</Detail>
        <Detail label="Memory limit">{instance.config["limits.memory"] ?? "—"}</Detail>
        <Detail label="CPU limit">{instance.config["limits.cpu"] ?? "—"}</Detail>
      </div>
      {instance.description && (
        <p className="rounded border border-border bg-surface-900 p-3 text-sm text-text-secondary">{instance.description}</p>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface-900 p-3">
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-1 text-sm text-text-primary">{children}</div>
    </div>
  );
}
