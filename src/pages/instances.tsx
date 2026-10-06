import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { instancesApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { instancesStore, instancesLoadingStore, loadInstances } from "../state/instances";
import { ALL_PROJECTS } from "../api/client";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";

import { instanceStatusTone } from "../lib/instance-status";
import { InstanceIcon, InstanceStatusIcon } from "../shell/instance-icon";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";
import { Camera, Copy as CopyIcon, Upload, Play, Square, RotateCw, Snowflake, Trash2, Plus, Eye } from "lucide-react";
import type { Instance, InstanceStateInfo } from "../api/types";
import { ipSummary } from "../lib/instance-status";
import { CopyInstanceDialog } from "../components/instance-dialogs";
import { ImportBackupDialog } from "../components/import-backup-dialog";

type Action = "start" | "stop" | "restart" | "freeze" | "unfreeze";

const keyOf = (i: Instance): string => `${i.project}/${i.name}`;

/** Run `fn` for every instance, then report one summary toast naming any failures. */
async function runForEach(
  verb: string,
  targets: Instance[],
  fn: (i: Instance) => Promise<unknown>,
): Promise<void> {
  const results = await Promise.allSettled(targets.map(fn));
  const failed = results.flatMap((r, idx) => (r.status === "rejected" ? [{ name: targets[idx]!.name, err: r.reason as unknown }] : []));
  if (failed.length === 0) return;
  const detail = failed.map((f) => `${f.name}: ${f.err instanceof Error ? f.err.message : "failed"}`).join("; ");
  toast("danger", `${verb} failed for ${failed.length} of ${targets.length} — ${detail}`);
}

const snapshotName = (): string => `snap-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;

export function InstancesPage({ location, onCreate, registerBar }: { location?: string; onCreate?: () => void; registerBar?: (bar: BarState | null) => void } = {}) {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const instancesLoading = useStore(instancesLoadingStore);
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [copySource, setCopySource] = useState<Instance | null>(null);
  const [ipMap, setIpMap] = useState<Record<string, string>>({});

  const scoped = useMemo(
    () => Object.values(instances).filter((i) => (project === ALL_PROJECTS || i.project === project) && (location === undefined || i.location === location)),
    [instances, project, location]
  );

  useEffect(() => {
    void loadInstances(project);
  }, [project]);

  const instanceNames = useMemo(() => scoped.map((i) => i.name).sort().join(","), [scoped]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      scoped.map(async (instance) => {
        try {
          const state = await instancesApi.state(instance.name, instance.project);
          const { ipv4, ipv6, extra } = ipSummary(state as InstanceStateInfo | null);
          const parts = [ipv4, ipv6].filter((ip): ip is string => ip !== undefined);
          const label = parts.length > 0 ? parts.join(", ") + (extra > 0 ? ` +${extra} more` : "") : "—";
          return [keyOf(instance), label] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const e of entries) if (e) next[e[0]] = e[1];
      setIpMap(next);
    });
    return () => { cancelled = true; };
  }, [instanceNames]);

  const selected = useMemo(() => scoped.filter((i) => selectedKeys.includes(keyOf(i))), [scoped, selectedKeys]);

  const withBusy = useCallback(async (targets: Instance[], work: () => Promise<void>) => {
    const keys = targets.map(keyOf);
    setBusy((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, true])) }));
    try {
      await work();
    } finally {
      setBusy((prev) => ({ ...prev, ...Object.fromEntries(keys.map((k) => [k, false])) }));
    }
  }, []);

  const runAction = useCallback(
    (action: Action, targets: Instance[]) =>
      withBusy(targets, () => runForEach(action[0]!.toUpperCase() + action.slice(1), targets, (i) => instancesApi.setState(i.name, action, false, i.project))),
    [withBusy],
  );

  const runSnapshot = useCallback(
    (targets: Instance[]) =>
      withBusy(targets, async () => {
        const snap = snapshotName();
        await runForEach("Snapshot", targets, (i) => instancesApi.createSnapshot(i.name, snap, false, i.project));
        toast("info", `Requested snapshot ${snap} for ${targets.length} instance(s)`);
      }),
    [withBusy],
  );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await runForEach("Delete", selected, (i) => instancesApi.delete(i.name, i.project));
      toast("success", `Deleted ${selected.length} instance(s)`);
      setSelectedKeys([]);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const columns: Column<Instance>[] = [
    ...(project === ALL_PROJECTS
      ? [{ key: "project", header: "Project", sortValue: (i: Instance) => i.project, render: (i: Instance) => <span className="text-text-secondary">{i.project}</span> }]
      : []),
    {
      key: "name", header: "Name", sortValue: (i) => i.name,
      render: (i) => (
        <span className="flex items-center gap-2 font-medium">
          <InstanceIcon status={i.status} type={i.type} />
          {i.name}
        </span>
      ),
    },
    {
      key: "status", header: "Status", sortValue: (i) => i.status,
      render: (i) => (
        <Badge tone={instanceStatusTone(i.status)}>
          <span className="inline-flex items-center gap-1">
            <InstanceStatusIcon status={i.status} />
            {i.status}
          </span>
        </Badge>
      ),
    },
    { key: "type", header: "Type", render: (i) => (i.type === "container" ? "Container" : "VM") },
    {
      key: "ip", header: "IP addresses",
      render: (i) => <span className="text-xs text-text-secondary">{i.status === "Started" || i.status === "Running" ? (ipMap[keyOf(i)] ?? "—") : "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" data-testid={`row-overview-${i.name}`} onClick={() => navigate(`/instances/${i.name}?project=${encodeURIComponent(i.project)}`)} aria-label={`Overview ${i.name}`}><Eye size={14} /></Button>
          <Button size="sm" variant="ghost" data-testid={`row-copy-${i.name}`} onClick={() => setCopySource(i)} aria-label={`Copy ${i.name}`}><CopyIcon size={14} /></Button>
          {i.status !== "Started" && i.status !== "Running" && (
            <Button size="sm" variant="ghost" disabled={busy[keyOf(i)] ?? false} data-testid={`row-start-${i.name}`} onClick={() => runAction("start", [i])}><Play size={14} /> Start</Button>
          )}
          {(i.status === "Started" || i.status === "Running" || i.status === "Frozen") && (
            <Button size="sm" variant="ghost" disabled={busy[keyOf(i)] ?? false} data-testid={`row-stop-${i.name}`} onClick={() => runAction("stop", [i])}><Square size={14} /> Stop</Button>
          )}
        </div>
      ),
    },
  ];

  const actionDisabled = selected.length === 0;

  const barActions = useMemo(
    () => [
      ...(onCreate ? [<Button key="create" size="sm" onClick={onCreate} data-testid="action-create"><Plus size={14} /> Create instance</Button>] : []),
      <Button key="import" size="sm" variant="secondary" data-testid="action-import" onClick={() => setImportOpen(true)}><Upload size={14} /> Import</Button>,
      <Button key="start" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-start" onClick={() => runAction("start", selected)}><Play size={14} /> Start</Button>,
      <Button key="stop" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-stop" onClick={() => runAction("stop", selected)}><Square size={14} /> Stop</Button>,
      <Button key="restart" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-restart" onClick={() => runAction("restart", selected)}><RotateCw size={14} /> Restart</Button>,
      <Button key="freeze" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-freeze" onClick={() => runAction("freeze", selected)}><Snowflake size={14} /> Freeze</Button>,
      <Button key="snapshot" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-snapshot" onClick={() => runSnapshot(selected)}><Camera size={14} /> Snapshot</Button>,
      <Button key="delete" size="sm" variant="danger" disabled={actionDisabled} data-testid="action-delete" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</Button>,
    ],
    [onCreate, actionDisabled, selected, runAction, runSnapshot, setDeleteOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Instances", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="instances-page">
      {!registerBar && <PageBar title="Instances" actions={barActions} />}

      {instancesLoading && scoped.length === 0 ? (
        <Loading dataTestId="instances-loading" label="Loading instances…" />
      ) : scoped.length === 0 ? (
        <EmptyState
          title="No instances"
          description="Create your first instance to get started."
          action={onCreate && <Button size="sm" onClick={onCreate} data-testid="action-create-empty"><Plus size={14} /> Create instance</Button>}
        />
      ) : (
        <Table
          persistKey="instances"
          columns={columns}
          rows={scoped}
          rowKey={keyOf}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowClick={(i) => navigate(`/instances/${i.name}?project=${encodeURIComponent(i.project)}`)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete instances"
        body={`This will permanently delete ${selected.length} instance(s): ${selected.map((i) => i.name).join(", ")}. This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <ImportBackupDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <CopyInstanceDialog open={copySource !== null} onClose={() => setCopySource(null)} name={copySource?.name ?? ""} project={copySource?.project} defaultPool={copySource?.devices.root?.pool} />
    </div>
  );
}
