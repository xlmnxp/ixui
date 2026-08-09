import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { instancesApi } from "../api";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { instancesStore, loadInstances } from "../state/instances";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { instanceStatusTone } from "../lib/instance-status";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";
import type { Instance } from "../api/types";

type Action = "start" | "stop" | "restart" | "freeze" | "unfreeze";

export function InstancesPage({ location, onCreate }: { location?: string; onCreate?: () => void } = {}) {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const navigate = useNavigate();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scoped = useMemo(
    () => Object.values(instances).filter((i) => i.project === project && (location === undefined || i.location === location)),
    [instances, project, location]
  );

  useEffect(() => {
    void loadInstances(project);
  }, [project]);

  const runAction = async (action: Action, names: string[]) => {
    setBusy(() => Object.fromEntries(names.map((n) => [n, true])));
    try {
      await Promise.all(names.map((n) => instancesApi.setState(n, action)));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(() => Object.fromEntries(names.map((n) => [n, false])));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all(selectedKeys.map((n) => instancesApi.delete(n)));
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
      render: (i) => <span className="text-xs text-text-secondary">{i.status === "Started" || i.status === "Running" ? (i.devices.eth0?.["ipv4.address"] ?? i.devices.eth0?.["ipv4"] ?? "—") : "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-start-${i.name}`} onClick={() => runAction("start", [i.name])}>Start</Button>
          <Button size="sm" variant="ghost" disabled={busy[i.name] ?? false} data-testid={`row-stop-${i.name}`} onClick={() => runAction("stop", [i.name])}>Stop</Button>
        </div>
      ),
    },
  ];

  const actionDisabled = selectedKeys.length === 0;

  return (
    <div className="space-y-4 p-6" data-testid="instances-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Instances</h1>
        <div className="flex gap-2">
          {onCreate && <Button size="sm" onClick={onCreate} data-testid="action-create">Create instance</Button>}
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-start" onClick={() => runAction("start", selectedKeys)}>Start</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-stop" onClick={() => runAction("stop", selectedKeys)}>Stop</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-restart" onClick={() => runAction("restart", selectedKeys)}>Restart</Button>
          <Button size="sm" variant="secondary" disabled={actionDisabled} data-testid="action-freeze" onClick={() => runAction("freeze", selectedKeys)}>Freeze</Button>
          <Button size="sm" variant="danger" disabled={actionDisabled} data-testid="action-delete" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      {scoped.length === 0 ? (
        <EmptyState
          title="No instances"
          description="Create your first instance to get started."
          action={onCreate && <Button size="sm" onClick={onCreate} data-testid="action-create-empty">Create instance</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={scoped}
          rowKey={(i) => i.name}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          onRowClick={(i) => navigate(`/instances/${i.name}`)}
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
    </div>
  );
}
