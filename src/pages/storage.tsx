import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { StoragePool, StorageVolume } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

export function StoragePage() {
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [volumes, setVolumes] = useState<Record<string, StorageVolume[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePoolTarget, setDeletePoolTarget] = useState<StoragePool | null>(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<{ pool: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("dir");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listPools().then((list) => {
      setPools(list);
      setVolumes((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (!list.some((p) => p.name === key)) delete next[key];
        }
        return next;
      });
    }).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const toggleVolumes = async (pool: string) => {
    if (volumes[pool]) {
      const next = { ...volumes };
      delete next[pool];
      setVolumes(next);
      return;
    }
    try {
      const list = await infraApi.listPoolVolumes(pool);
      setVolumes((prev) => ({ ...prev, [pool]: list }));
    } catch {
      toast("danger", "Failed to load pool volumes");
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createPool({ name: name.trim(), driver });
      toast("success", `Pool ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const removePool = async () => {
    if (!deletePoolTarget) return;
    const poolName = deletePoolTarget.name;
    try {
      await infraApi.deletePool(poolName);
      toast("success", `Pool ${poolName} deleted`);
      setVolumes((prev) => {
        const next = { ...prev };
        delete next[poolName];
        return next;
      });
      setDeletePoolTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const removeVolume = async () => {
    if (!deleteVolumeTarget) return;
    try {
      await infraApi.deletePoolVolume(deleteVolumeTarget.pool, deleteVolumeTarget.name);
      toast("success", `Volume ${deleteVolumeTarget.name} deleted`);
      setDeleteVolumeTarget(null);
      await toggleVolumes(deleteVolumeTarget.pool);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const renderVolumeTable = (poolName: string, list: StorageVolume[]) => (
    <Table
      columns={[
        { key: "name", header: "Name", render: (v: StorageVolume) => v.name },
        { key: "content", header: "Content type", render: (v: StorageVolume) => v.content_type },
        {
          key: "actions", header: "", align: "right",
          render: (v: StorageVolume) => (
            <Button size="sm" variant="ghost" data-testid={`volume-delete-${v.name}`} onClick={() => setDeleteVolumeTarget({ pool: poolName, name: v.name })}>Delete</Button>
          ),
        },
      ]}
      rows={list}
      rowKey={(v) => v.name}
    />
  );

  const columns: Column<StoragePool>[] = [
    { key: "name", header: "Name", sortValue: (p) => p.name, render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "driver", header: "Driver", render: (p) => p.driver },
    { key: "status", header: "Status", render: (p) => p.status },
    { key: "used", header: "Used by", render: (p) => p.used_by.length },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`pool-volumes-${p.name}`} onClick={() => void toggleVolumes(p.name)}>Volumes</Button>
          <Button size="sm" variant="ghost" data-testid={`pool-delete-${p.name}`} onClick={() => setDeletePoolTarget(p)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="storage-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Storage pools</h1>
        <Button size="sm" data-testid="pool-create-open" onClick={() => setCreateOpen(true)}>Create pool</Button>
      </div>

      {pools.length === 0 ? (
        <EmptyState title="No storage pools" />
      ) : (
        <Table columns={columns} rows={pools} rowKey={(p) => p.name} />
      )}

      {Object.entries(volumes).map(([poolName, list]) => (
        <div key={poolName} className="rounded border border-border bg-surface-900 p-3">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Volumes in {poolName}</h2>
          {renderVolumeTable(poolName, list)}
        </div>
      ))}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create storage pool" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="pool-create-submit">Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="pool-name" data-testid="pool-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Driver" name="pool-driver" data-testid="pool-driver" value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="dir">dir</option>
            <option value="btrfs">btrfs</option>
            <option value="lvm">lvm</option>
            <option value="zfs">zfs</option>
          </Select>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deletePoolTarget !== null}
        title="Delete pool"
        body={`Delete pool ${deletePoolTarget?.name}? This is destructive.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removePool}
        onCancel={() => setDeletePoolTarget(null)}
      />
      <ConfirmDialog
        open={deleteVolumeTarget !== null}
        title="Delete volume"
        body={`Delete volume ${deleteVolumeTarget?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removeVolume}
        onCancel={() => setDeleteVolumeTarget(null)}
      />
    </div>
  );
}
