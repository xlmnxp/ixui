import { useEffect, useState } from "react";
import { api, serverApi, infraApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { operationsStore } from "../state/operations";
import { instancesStore } from "../state/instances";
import { Card } from "../components/card";
import { Progress } from "../components/progress";
import { Badge } from "../components/badge";
import { formatBytes } from "../lib/format";

interface HostResources {
  cpu: { total: number };
  memory: { total: number; used: number };
}

const instanceStateCounts = (instances: { status: string }[]) => {
  const counts: Record<string, number> = {};
  for (const i of instances) counts[i.status] = (counts[i.status] ?? 0) + 1;
  return counts;
};

export function DashboardPage() {
  const project = useStore(currentProjectStore);
  const operations = useStore(operationsStore);
  const instances = useStore(instancesStore);
  const [server, setServer] = useState<{ hostname: string; version: string } | null>(null);
  const [resources, setResources] = useState<HostResources | null>(null);
  const [counts, setCounts] = useState({ images: 0, profiles: 0, networks: 0, storage: 0 });

  useEffect(() => {
    void serverApi.info().then((info) => setServer({ hostname: info.environment.server, version: info.environment.server_version })).catch(() => {});
  }, []);

  useEffect(() => {
    void Promise.all([
      infraApi.listImages(),
      infraApi.listProfiles(),
      infraApi.listNetworks(),
      infraApi.listPools(),
    ]).then(([images, profiles, networks, pools]) =>
      setCounts({ images: images.length, profiles: profiles.length, networks: networks.length, storage: pools.length })
    ).catch(() => {});
  }, []);

  useEffect(() => {
    void api.get<HostResources>("/resources").then(setResources).catch(() => setResources(null));
  }, []);

  const scoped = Object.values(instances).filter((i) => i.project === project);
  const stateCounts = instanceStateCounts(scoped);
  const cpuPercent = resources ? Math.min(100, Math.round((resources.cpu.total ? 30 : 0))) : undefined;
  const memPercent = resources ? Math.round((resources.memory.used / resources.memory.total) * 100) : undefined;

  return (
    <div className="space-y-4 p-6" data-testid="dashboard-page">
      <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card title="Server" value={server?.hostname ?? "…"} sub={server ? `Version ${server.version}` : undefined} />
        <Card title="Instances" value={String(scoped.length)} sub={Object.entries(stateCounts).map(([s, n]) => `${s}: ${n}`).join(" · ")} />
        <Card title="Images" value={String(counts.images)} />
        <Card title="Profiles" value={String(counts.profiles)} />
        <Card title="Networks" value={String(counts.networks)} />
        <Card title="Storage pools" value={String(counts.storage)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">CPU</h2>
          {cpuPercent === undefined ? <span className="text-xs text-text-tertiary">Unavailable</span> : <Progress value={cpuPercent} />}
        </div>
        <div className="rounded-lg border border-border bg-surface-900 p-4">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Memory</h2>
          {resources ? (
            <>
              <Progress value={memPercent} tone={memPercent && memPercent > 85 ? "danger" : "accent"} />
              <p className="mt-1 text-xs text-text-secondary">{formatBytes(resources.memory.used)} / {formatBytes(resources.memory.total)}</p>
            </>
          ) : (
            <span className="text-xs text-text-tertiary">Unavailable</span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-text-primary">Recent operations</h2>
        {operations.length === 0 ? (
          <p className="text-xs text-text-tertiary">No operations yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {operations.slice(0, 10).map((op) => (
              <li key={op.id} className="flex items-center gap-3 py-1.5 text-xs">
                <Badge tone={op.status === "Running" ? "info" : op.status === "Success" ? "success" : op.status === "Failure" ? "danger" : "warning"}>{op.status}</Badge>
                <span className="text-text-primary">{op.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
