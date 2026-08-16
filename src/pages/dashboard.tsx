import { useEffect, useState } from "react";
import { serverApi, infraApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { ALL_PROJECTS } from "../api/client";
import { operationsStore } from "../state/operations";
import { instancesStore } from "../state/instances";
import { KeyValueTable } from "../components/key-value-table";
import { Loading } from "../components/loading";
import { Badge } from "../components/badge";
import { PageBar } from "../components/page-bar";
import { SplitPane } from "../components/split-pane";

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
  const [counts, setCounts] = useState({ images: 0, profiles: 0, networks: 0, storage: 0 });
  const [serverLoaded, setServerLoaded] = useState(false);
  const [countsLoaded, setCountsLoaded] = useState(false);

  useEffect(() => {
    void serverApi.info().then((info) => setServer({ hostname: info.environment.server, version: info.environment.server_version })).catch(() => {}).finally(() => setServerLoaded(true));
  }, []);

  useEffect(() => {
    void Promise.all([
      infraApi.listImages(),
      infraApi.listProfiles(),
      infraApi.listNetworks(),
      infraApi.listPools(),
    ]).then(([images, profiles, networks, pools]) =>
      setCounts({ images: images.length, profiles: profiles.length, networks: networks.length, storage: pools.length })
    ).catch(() => {}).finally(() => setCountsLoaded(true));
  }, []);

  const scoped = Object.values(instances).filter((i) => project === ALL_PROJECTS || i.project === project);
  const stateCounts = instanceStateCounts(scoped);

  return (
    <div className="flex h-full flex-col" data-testid="dashboard-page">
      <PageBar title="Dashboard" />
      <div className="min-h-0 flex-1">
        <SplitPane
          vertical
          initial={45}
          min={25}
          left={
            !serverLoaded || !countsLoaded ? (
              <Loading dataTestId="dashboard-loading" label="Loading dashboard…" />
            ) : (
            <KeyValueTable
              dataTestId="dashboard-overview-table"
              rows={[
                { key: "Hostname", value: server?.hostname ?? "—" },
                { key: "Version", value: server ? `Version ${server.version}` : "—" },
                { key: "Project", value: project },
                { key: "Instances by state", value: Object.entries(stateCounts).map(([s, n]) => `${s}: ${n}`).join(" · ") || "—" },
                { key: "Images", value: String(counts.images) },
                { key: "Profiles", value: String(counts.profiles) },
                { key: "Networks", value: String(counts.networks) },
                { key: "Storage pools", value: String(counts.storage) },
              ]}
            />
            )
          }
          right={
            <div className="h-full overflow-auto border-t border-border">
              <h2 className="px-3 py-2 text-xs font-semibold text-text-secondary">Recent operations</h2>
              {operations.length === 0 ? (
                <p className="px-3 pb-2 text-xs text-text-tertiary">No operations yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {operations.slice(0, 10).map((op) => (
                    <li key={op.id} className="flex items-center gap-3 px-3 py-1.5 text-xs">
                      <Badge tone={op.status === "Running" ? "info" : op.status === "Success" ? "success" : op.status === "Failure" ? "danger" : "warning"}>{op.status}</Badge>
                      <span className="text-text-primary">{op.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
