import { useEffect, useState } from "react";
import { instancesApi, resourcesApi } from "../api";
import type { Instance, InstanceStateInfo } from "../api/types";
import { Badge } from "../components/badge";
import { KeyValueTable } from "../components/key-value-table";
import { Sparkline } from "../components/sparkline";
import { instanceStatusTone, instanceIps } from "../lib/instance-status";
import { InstanceStatusIcon } from "../shell/instance-icon";
import { formatBytes } from "../lib/format";
import { useStore } from "../state/store";
import { metricsStore, startMetricsPolling, stopMetricsPolling } from "../state/metrics";

export interface OverviewTabProps {
  instance: Instance;
}

export function OverviewTab({ instance }: OverviewTabProps) {
  const [state, setState] = useState<InstanceStateInfo | null>(null);
  const [hostMemoryTotal, setHostMemoryTotal] = useState<number | null>(null);
  const metrics = useStore(metricsStore);
  const metricsKey = `${instance.project}/${instance.name}`;
  const live = metrics[metricsKey];

  useEffect(() => {
    void instancesApi.state(instance.name, instance.project).then(setState).catch(() => setState(null));
  }, [instance.name, instance.project]);

  useEffect(() => {
    startMetricsPolling(instance.name, instance.project);
    return () => stopMetricsPolling(instance.name, instance.project);
  }, [instance.name, instance.project]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = instance.location
          ? await resourcesApi.getMemberResources(instance.location)
          : await resourcesApi.get();
        setHostMemoryTotal(typeof res.memory?.total === "number" ? res.memory.total : null);
      } catch {
        setHostMemoryTotal(null);
      }
    };
    void load();
  }, [instance.location]);

  const ips = instanceIps(state);

  const rows = [
    { key: "Status", value: <Badge tone={instanceStatusTone(instance.status)}><span className="inline-flex items-center gap-1"><InstanceStatusIcon status={instance.status} />{instance.status}</span></Badge> },
    { key: "Type", value: instance.type === "container" ? "Container" : "Virtual machine" },
    { key: "Created", value: new Date(instance.created_at).toLocaleString() },
    { key: "Last used", value: instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never" },
    { key: "Profiles", value: instance.profiles.join(", ") || "—" },
    ...(ips.length > 0
      ? ips.map((ip) => ({ id: `ip-${ip}`, key: "IP address", value: ip }))
      : [{ key: "IP addresses", value: "—" }]),
    { key: "Memory limit", value: instance.config["limits.memory"] ?? "—" },
    { key: "CPU limit", value: instance.config["limits.cpu"] ?? "—" },
    ...(live && live.cpu.length > 0
      ? [{
          id: "cpu-usage",
          key: "CPU usage",
          value: (
            <span className="flex items-center gap-2">
              <Sparkline points={live.cpu.map((p) => p.value)} />
              <span className="text-xs text-text-secondary">{live.cpu[live.cpu.length - 1]!.value.toFixed(1)}%</span>
            </span>
          ),
        }]
      : []),
    ...(live && live.memory.length > 0
      ? [{
          id: "memory-usage",
          key: "Memory usage",
          value: (
            <span className="flex items-center gap-2">
              <Sparkline points={live.memory.map((p) => p.value)} color="#58a6ff" />
              <span className="text-xs text-text-secondary">
                {formatBytes(live.memory[live.memory.length - 1]!.value)}
                {instance.config["limits.memory"]
                  ? ` / ${instance.config["limits.memory"]}`
                  : hostMemoryTotal !== null
                    ? ` / ${formatBytes(hostMemoryTotal)}`
                    : ""}
              </span>
            </span>
          ),
        }]
      : []),
  ];

  return (
    <div data-testid="overview-tab">
      <KeyValueTable rows={rows} />
      {instance.description && <p className="mt-2 border-t border-border px-3 py-2 text-sm text-text-secondary">{instance.description}</p>}
    </div>
  );
}
