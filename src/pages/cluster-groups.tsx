import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { clusterApi } from "../api";
import type { ClusterGroup } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

export function ClusterGroupsPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [groups, setGroups] = useState<ClusterGroup[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClusterGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClusterGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void clusterApi.listGroups().then(setGroups).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await clusterApi.createGroup({ name: name.trim(), description: description.trim() });
      toast("success", `Group ${name} created`);
      setCreateOpen(false);
      setName("");
      setDescription("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await clusterApi.updateGroup(editing.name, { description: description.trim() });
      toast("success", `Group ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await clusterApi.deleteGroup(deleteTarget.name);
      toast("success", `Group ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<ClusterGroup>[] = [
    { key: "name", header: "Name", sortValue: (g) => g.name, render: (g) => <span className="font-medium">{g.name}</span> },
    { key: "description", header: "Description", render: (g) => g.description || "—" },
    { key: "nodes", header: "Nodes", render: (g) => (g.nodes.length > 0 ? g.nodes.join(", ") : "—") },
    {
      key: "actions", header: "", align: "right",
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`group-edit-${g.name}`} onClick={() => { setEditing(g); setDescription(g.description); }}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`group-delete-${g.name}`} onClick={() => setDeleteTarget(g)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="create" size="sm" data-testid="group-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create group</Button>,
    ],
    [setCreateOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Cluster groups", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div className="space-y-4" data-testid="cluster-groups-page">
      {!registerBar && <PageBar title="Cluster groups" actions={barActions} />}

      {groups.length === 0 ? (
        <EmptyState title="No cluster groups" />
      ) : (
        <Table columns={columns} rows={groups} rowKey={(g) => g.name} dataTestId="groups-table" />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create group" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="group-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="group-name" data-testid="group-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" name="group-desc" data-testid="group-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit group ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="group-save"><Check size={14} /> Save</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="group-edit-name" data-testid="group-edit-name" value={editing?.name ?? ""} disabled />
          <Input label="Description" name="group-edit-desc" data-testid="group-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete group"
        body={`Delete group ${deleteTarget?.name}? Members in the group will lose its role.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
