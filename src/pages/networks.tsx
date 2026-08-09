import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Network } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

export function NetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Network | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("bridge");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listNetworks().then(setNetworks).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createNetwork({ name: name.trim(), type, description: description.trim() });
      toast("success", `Network ${name} created`);
      setCreateOpen(false);
      setName("");
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
      await infraApi.updateNetwork(editing.name, { description });
      toast("success", `Network ${editing.name} saved`);
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
      await infraApi.deleteNetwork(deleteTarget.name);
      toast("success", `Network ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Network>[] = [
    { key: "name", header: "Name", sortValue: (n) => n.name, render: (n) => <span className="font-medium">{n.name}</span> },
    { key: "type", header: "Type", render: (n) => n.type },
    { key: "managed", header: "Managed", render: (n) => (n.managed ? "Yes" : "No") },
    { key: "used", header: "Used by", render: (n) => n.used_by.length },
    { key: "status", header: "Status", render: (n) => n.status },
    {
      key: "actions", header: "", align: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`network-edit-${n.name}`} onClick={() => { setEditing(n); setDescription(n.description); }}>Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`network-delete-${n.name}`} onClick={() => setDeleteTarget(n)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="networks-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Networks</h1>
        <Button size="sm" data-testid="network-create-open" onClick={() => setCreateOpen(true)}>Create network</Button>
      </div>

      {networks.length === 0 ? (
        <EmptyState title="No networks" />
      ) : (
        <Table columns={columns} rows={networks} rowKey={(n) => n.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create network" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="network-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="network-name" data-testid="network-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Type" name="network-type" data-testid="network-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bridge">bridge</option>
            <option value="ovn">ovn</option>
            <option value="physical">physical</option>
            <option value="macvlan">macvlan</option>
          </Select>
          <Input label="Description" name="network-desc" data-testid="network-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit network ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="network-save">Save</Button>
        </>
      }>
        <Input label="Description" name="network-edit-desc" data-testid="network-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete network"
        body={`Delete network ${deleteTarget?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
