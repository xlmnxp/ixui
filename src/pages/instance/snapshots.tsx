import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Button } from "../../components/button";
import { Dialog } from "../../components/dialog";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Input } from "../../components/input";
import { Switch } from "../../components/switch";
import { EmptyState } from "../../components/empty-state";
import { toast } from "../../components/toast";

export interface SnapshotsTabProps {
  instanceName: string;
}

export function SnapshotsTab({ instanceName }: SnapshotsTabProps) {
  const [snapshots, setSnapshots] = useState<Instance[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stateful, setStateful] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void instancesApi.listSnapshots(instanceName).then(setSnapshots).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await instancesApi.createSnapshot(instanceName, name.trim(), stateful);
      toast("success", `Snapshot ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreName) return;
    setBusy(true);
    try {
      await instancesApi.restoreSnapshot(instanceName, restoreName);
      toast("success", `Restored ${restoreName}`);
      refresh();
      setRestoreName(null);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (snapName: string) => {
    try {
      await instancesApi.deleteSnapshot(instanceName, snapName);
      toast("success", `Deleted snapshot ${snapName}`);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Instance>[] = [
    { key: "name", header: "Name", sortValue: (s) => s.name, render: (s) => s.name },
    { key: "created", header: "Created", render: (s) => new Date(s.created_at).toLocaleString() },
    {
      key: "actions", header: "", align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`snap-restore-${s.name}`} onClick={() => setRestoreName(s.name)}>Restore</Button>
          <Button size="sm" variant="ghost" data-testid={`snap-delete-${s.name}`} onClick={() => remove(s.name)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="snapshots-tab">
      <div className="flex justify-end">
        <Button size="sm" data-testid="snap-create-open" onClick={() => setCreateOpen(true)}>Create snapshot</Button>
      </div>
      {snapshots.length === 0 ? (
        <EmptyState title="No snapshots" description="Snapshots let you roll back to a previous state." />
      ) : (
        <Table columns={columns} rows={snapshots} rowKey={(s) => s.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create snapshot" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="snap-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="snap-name" data-testid="snap-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Switch checked={stateful} onChange={setStateful} label="Stateful (include running state)" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={restoreName !== null}
        title={`Restore snapshot ${restoreName ?? ""}`}
        body="The instance will be reverted to this snapshot's state. Running instances will be stopped."
        confirmLabel="Restore"
        loading={busy}
        onConfirm={restore}
        onCancel={() => setRestoreName(null)}
      />
    </div>
  );
}
