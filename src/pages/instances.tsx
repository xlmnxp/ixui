import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { instancesApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { instancesStore, loadInstances } from "../state/instances";
import { ALL_PROJECTS } from "../api/client";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { instanceStatusTone } from "../lib/instance-status";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";
import { Copy as CopyIcon, Play, Square, RotateCw, Snowflake, Trash2, Plus, Eye } from "lucide-react";
import type { Instance, InstanceStateInfo } from "../api/types";
import { ipSummary } from "../lib/instance-status";
import { CopyInstanceDialog } from "../components/instance-dialogs";

type Action = "start" | "stop" | "restart" | "freeze" | "unfreeze";

export function InstancesPage({ location, onCreate, registerBar }: { location?: string; onCreate?: () => void; registerBar?: (bar: BarState | null) => void } = {}) {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
          return [instance.name, label] as const;
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

  const runAction = useCallback(async (action: Action, names: string[]) => {
    const projectByName = new Map(scoped.map((i) => [i.name, i.project]));
    setBusy(() => Object.fromEntries(names.map((n) => [n, true])));
    try {
      await Promise.all(names.map((n) => instancesApi.setState(n, action, false, projectByName.get(n))));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(() => Object.fromEntries(names.map((n) => [n, false])));
    }
  }, [scoped]);

  const confirmDelete = async () => {
    const projectByName = new Map(scoped.map((i) => [i.name, i.project]));
    setDeleting(true);
    try {
      await Promise.all(selectedKeys.map((n) => instancesApi.delete(n, projectByName.get(n))));
      toast("success", `Deleted ${selectedKeys.length} instance(s)`);
      setSelectedKeys([]);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
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
      render: (i) => <span className="font-medium">{i.name}</span>,
    },
    {
      key: "status", header: "Status", sortValue: (i) => i.status,
      render: (i) => (
        <span className="inline-flex items-center gap-2">
          <StatusDot tone={instanceStatusTone(i.status)} />
          <Badge tone={instanceStatusTone(i.status)}>{i.status}</Badge>
        </span>
      ),
    },
    { key: "type", header: "Type", render: (i) => (i.type === "container" ? "Container" : "VM") },
    {
      key: "ip", header: "IP addresses",
      render: (i) => <span className="text-xs text-text-secondary">{i.status === "Started" || i.status === "Running" ? (ipMap[i.name] ?? "—") : "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" data-testid={`row-overview-${i.name}`} onClick={() => navigate(`/instances/${i.name}?project=${encodeURIComponent(i.project)}`)} aria-label={`Overview ${i.name}`}><Eye size={14} /></Button>
          <Button size="sm" variant="ghost" data-testid={`row-copy-${i.name}`} onClick={() => setCopySource(i)} aria-label={`Copy ${i.name}`}><CopyIcon size={14} /></Button>
          {i.status !== "Started" && i.status !== "Running" && (
            <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-start-${i.name}`} onClick={() => runAction("start", [i.name])}><Play size={14} /> Start</Button>
          )}
          {(i.status === "Started" || i.status === "Running" || i.status === "Frozen") && (
            <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-stop-${i.name}`} onClick={() => runAction("stop", [i.name])}><Square size={14} /> Stop</Button>
          )}
        </div>
      ),
    },
  ];

  const actionDisabled = selectedKeys.length === 0;

  const barActions = useMemo(
    () => [
      ...(onCreate ? [<Button key="create" size="sm" onClick={onCreate} data-testid="action-create"><Plus size={14} /> Create instance</Button>] : []),
      <Button key="start" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-start" onClick={() => runAction("start", selectedKeys)}><Play size={14} /> Start</Button>,
      <Button key="stop" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-stop" onClick={() => runAction("stop", selectedKeys)}><Square size={14} /> Stop</Button>,
      <Button key="restart" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-restart" onClick={() => runAction("restart", selectedKeys)}><RotateCw size={14} /> Restart</Button>,
      <Button key="freeze" size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-freeze" onClick={() => runAction("freeze", selectedKeys)}><Snowflake size={14} /> Freeze</Button>,
      <Button key="delete" size="sm" variant="danger" disabled={actionDisabled} data-testid="action-delete" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</Button>,
    ],
    [onCreate, actionDisabled, selectedKeys, runAction, setDeleteOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Instances", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="instances-page">
      {!registerBar && <PageBar title="Instances" actions={barActions} />}

      {scoped.length === 0 ? (
        <EmptyState
          title="No instances"
          description="Create your first instance to get started."
          action={onCreate && <Button size="sm" onClick={onCreate} data-testid="action-create-empty"><Plus size={14} /> Create instance</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={scoped}
          rowKey={(i) => i.name}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowClick={(i) => navigate(`/instances/${i.name}?project=${encodeURIComponent(i.project)}`)}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete instances"
        body={`This will permanently delete ${selectedKeys.length} instance(s). This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <CopyInstanceDialog open={copySource !== null} onClose={() => setCopySource(null)} name={copySource?.name ?? ""} project={copySource?.project} defaultPool={copySource?.devices.root?.pool} />
    </div>
  );
}
