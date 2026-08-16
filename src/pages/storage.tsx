import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Database, Disc, HardDrive, Pencil, Plus, Trash2, X } from "lucide-react";
import { infraApi, instancesApi, volumesApi } from "../api";
import type { Instance, StoragePool, StorageVolume, StorageVolumeDetail } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

interface VolumeRef {
  pool: string;
  type: string;
  name: string;
}

const toBytes = (size: string): number => {
  const m = /^([\d.]+)\s*([A-Za-z]*)$/.exec(size.trim());
  if (!m) return Number.NaN;
  const units: Record<string, number> = {
    "": 1, B: 1, K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4,
    KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15,
    KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5,
  };
  const unit = m[2] || "B";
  const factor = units[unit];
  if (factor === undefined) return Number.NaN;
  const value = parseFloat(m[1] ?? "");
  if (Number.isNaN(value)) return Number.NaN;
  return value * factor;
};

export function StoragePage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [volumes, setVolumes] = useState<Record<string, StorageVolume[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [deletePoolTarget, setDeletePoolTarget] = useState<StoragePool | null>(null);
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("dir");
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);

  const [volumeCreatePool, setVolumeCreatePool] = useState<string | null>(null);
  const [volumeName, setVolumeName] = useState("");
  const [volumeContentType, setVolumeContentType] = useState("filesystem");
  const [volumeSize, setVolumeSize] = useState("");
  const [volumeConfig, setVolumeConfig] = useState<Record<string, string>>({});
  const [volumeError, setVolumeError] = useState("");

  const [editTarget, setEditTarget] = useState<VolumeRef | null>(null);
  const [editContentType, setEditContentType] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, string>>({});

  const [resizeTarget, setResizeTarget] = useState<(VolumeRef & { currentSize: string }) | null>(null);
  const [resizeSize, setResizeSize] = useState("");
  const [resizeError, setResizeError] = useState("");

  const [renameTarget, setRenameTarget] = useState<VolumeRef | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");

  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<VolumeRef | null>(null);

  const [snapshotOpen, setSnapshotOpen] = useState<Record<string, boolean>>({});
  const [snapshots, setSnapshots] = useState<Record<string, StorageVolumeDetail[]>>({});
  const [snapCreateTarget, setSnapCreateTarget] = useState<VolumeRef | null>(null);
  const [snapName, setSnapName] = useState("");
  const [snapRestoreTarget, setSnapRestoreTarget] = useState<VolumeRef & { snap: string } | null>(null);
  const [snapDeleteTarget, setSnapDeleteTarget] = useState<VolumeRef & { snap: string } | null>(null);

  const [attachTarget, setAttachTarget] = useState<VolumeRef | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [attachInstance, setAttachInstance] = useState("");

  const [isoOpen, setIsoOpen] = useState(false);
  const [isoPool, setIsoPool] = useState("");
  const [isoFile, setIsoFile] = useState<File | null>(null);
  const [isoError, setIsoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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

  const refreshVolumes = useCallback(async (pool: string) => {
    try {
      const list = await volumesApi.list(pool);
      setVolumes((prev) => ({ ...prev, [pool]: list }));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Failed to load pool volumes");
    }
  }, []);

  const toggleVolumes = async (pool: string) => {
    if (volumes[pool]) {
      const next = { ...volumes };
      delete next[pool];
      setVolumes(next);
      return;
    }
    await refreshVolumes(pool);
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

  const removeMany = async () => {
    setDeletingMany(true);
    try {
      await Promise.all(selectedKeys.map((poolName) => infraApi.deletePool(poolName)));
      toast("success", `Deleted ${selectedKeys.length} pool(s)`);
      setVolumes((prev) => {
        const next = { ...prev };
        for (const poolName of selectedKeys) delete next[poolName];
        return next;
      });
      setSelectedKeys([]);
      setDeleteManyOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeletingMany(false);
    }
  };

  const openVolumeCreate = (pool: string) => {
    setVolumeCreatePool(pool);
    setVolumeName("");
    setVolumeContentType("filesystem");
    setVolumeSize("");
    setVolumeConfig({});
    setVolumeError("");
  };

  const createVolume = async () => {
    if (!volumeCreatePool) return;
    const trimmed = volumeName.trim();
    if (!trimmed) {
      setVolumeError("Name is required");
      return;
    }
    const config = { ...volumeConfig };
    if (volumeSize.trim()) config.size = volumeSize.trim();
    setBusy(true);
    try {
      await volumesApi.create(volumeCreatePool, { name: trimmed, type: "custom", content_type: volumeContentType, config });
      toast("success", `Volume ${trimmed} created`);
      setVolumeCreatePool(null);
      await refreshVolumes(volumeCreatePool);
    } catch (err) {
      setVolumeError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (ref: VolumeRef) => {
    try {
      const detail = await volumesApi.get(ref.pool, ref.type, ref.name);
      setEditTarget(ref);
      setEditContentType(detail.content_type);
      setEditConfig(detail.config);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await volumesApi.update(editTarget.pool, editTarget.type, editTarget.name, { content_type: editContentType, config: editConfig });
      toast("success", `Volume ${editTarget.name} saved`);
      setEditTarget(null);
      await refreshVolumes(editTarget.pool);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const openResize = async (ref: VolumeRef) => {
    try {
      const detail = await volumesApi.get(ref.pool, ref.type, ref.name);
      setResizeTarget({ ...ref, currentSize: detail.config.size ?? "" });
      setResizeSize("");
      setResizeError("");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    }
  };

  const resizeVolume = async () => {
    if (!resizeTarget) return;
    const newBytes = toBytes(resizeSize);
    if (!resizeSize.trim() || Number.isNaN(newBytes) || newBytes <= 0) {
      setResizeError("Enter a valid size, e.g. 20GB");
      return;
    }
    const currentBytes = toBytes(resizeTarget.currentSize);
    if (!Number.isNaN(currentBytes) && newBytes < currentBytes) {
      setResizeError(`New size must be >= current size ${resizeTarget.currentSize}`);
      return;
    }
    setBusy(true);
    try {
      await volumesApi.resize(resizeTarget.pool, resizeTarget.type, resizeTarget.name, resizeSize.trim());
      toast("success", `Volume ${resizeTarget.name} resized`);
      setResizeTarget(null);
      await refreshVolumes(resizeTarget.pool);
    } catch (err) {
      setResizeError(err instanceof Error ? err.message : "Resize failed");
    } finally {
      setBusy(false);
    }
  };

  const openRename = (ref: VolumeRef) => {
    setRenameTarget(ref);
    setRenameValue(ref.name);
    setRenameError("");
  };

  const renameVolume = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Name is required");
      return;
    }
    if (trimmed === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    setBusy(true);
    try {
      await volumesApi.rename(renameTarget.pool, renameTarget.type, renameTarget.name, trimmed);
      toast("success", `Volume ${renameTarget.name} renamed to ${trimmed}`);
      setRenameTarget(null);
      await refreshVolumes(renameTarget.pool);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  };

  const removeVolume = async () => {
    if (!deleteVolumeTarget) return;
    const target = deleteVolumeTarget;
    try {
      await volumesApi.delete(target.pool, target.type, target.name);
      toast("success", `Volume ${target.name} deleted`);
      setDeleteVolumeTarget(null);
      await refreshVolumes(target.pool);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const snapshotKey = (ref: VolumeRef) => `${ref.pool}/${ref.name}`;

  const toggleSnapshots = async (ref: VolumeRef) => {
    const key = snapshotKey(ref);
    if (snapshotOpen[key]) {
      setSnapshotOpen((prev) => ({ ...prev, [key]: false }));
      return;
    }
    try {
      const list = await volumesApi.listSnapshots(ref.pool, ref.type, ref.name);
      setSnapshots((prev) => ({ ...prev, [key]: list }));
      setSnapshotOpen((prev) => ({ ...prev, [key]: true }));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Failed to load snapshots");
    }
  };

  const createSnapshot = async () => {
    if (!snapCreateTarget) return;
    const trimmed = snapName.trim();
    if (!trimmed) {
      toast("danger", "Snapshot name is required");
      return;
    }
    setBusy(true);
    try {
      await volumesApi.createSnapshot(snapCreateTarget.pool, snapCreateTarget.type, snapCreateTarget.name, trimmed);
      toast("success", `Snapshot ${trimmed} created`);
      setSnapCreateTarget(null);
      setSnapName("");
      const list = await volumesApi.listSnapshots(snapCreateTarget.pool, snapCreateTarget.type, snapCreateTarget.name);
      setSnapshots((prev) => ({ ...prev, [snapshotKey(snapCreateTarget)]: list }));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const restoreSnapshot = async () => {
    if (!snapRestoreTarget) return;
    const target = snapRestoreTarget;
    try {
      await volumesApi.restoreSnapshot(target.pool, target.type, target.name, target.snap);
      toast("success", `Volume ${target.name} restored from ${target.snap}`);
      setSnapRestoreTarget(null);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Restore failed");
    }
  };

  const removeSnapshot = async () => {
    if (!snapDeleteTarget) return;
    const target = snapDeleteTarget;
    try {
      await volumesApi.deleteSnapshot(target.pool, target.type, target.name, target.snap);
      toast("success", `Snapshot ${target.snap} deleted`);
      setSnapDeleteTarget(null);
      const list = await volumesApi.listSnapshots(target.pool, target.type, target.name);
      setSnapshots((prev) => ({ ...prev, [snapshotKey(target)]: list }));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const openAttach = async (ref: VolumeRef) => {
    setAttachTarget(ref);
    setAttachInstance("");
    try {
      const list = await instancesApi.list();
      setInstances(list);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Failed to load instances");
    }
  };

  const attachVolume = async () => {
    if (!attachTarget || !attachInstance) return;
    const instance = instances.find((i) => i.name === attachInstance);
    if (!instance) return;
    setBusy(true);
    try {
      const devices = { ...instance.devices };
      let index = 0;
      while (devices[`disk${index}`]) index++;
      devices[`disk${index}`] = { type: "disk", pool: attachTarget.pool, source: attachTarget.name, path: `/mnt/${attachTarget.name}` };
      await instancesApi.update(instance.name, { devices });
      toast("success", `Volume ${attachTarget.name} attached to ${instance.name}`);
      setAttachTarget(null);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Attach failed");
    } finally {
      setBusy(false);
    }
  };

  const importIso = async () => {
    if (!isoFile) {
      setIsoError("Choose an ISO file");
      return;
    }
    const base = isoFile.name.replace(/\.[^.]+$/, "");
    const isoName = base.trim() || "iso";
    setBusy(true);
    try {
      await volumesApi.create(isoPool, { name: isoName, type: "iso", content_type: "iso" });
      await volumesApi.uploadIso(isoPool, isoName, isoFile);
      toast("success", `ISO ${isoName} imported into ${isoPool}`);
      setIsoOpen(false);
      setIsoFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await refreshVolumes(isoPool);
    } catch (err) {
      setIsoError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const renderSnapshotTable = (ref: VolumeRef, list: StorageVolumeDetail[]) => (
    <div className="mt-2 rounded border border-border bg-surface-900 p-2">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text-primary">Snapshots of {ref.name}</h4>
        <Button size="sm" data-testid={`snapshot-create-${ref.name}`} onClick={() => setSnapCreateTarget(ref)}><Plus size={13} /> Create</Button>
      </div>
      <Table
        dataTestId={`snapshot-table-${ref.name}`}
        columns={[
          { key: "name", header: "Name", render: (s: StorageVolumeDetail) => s.name },
          { key: "created", header: "Created", render: (s: StorageVolumeDetail) => s.created_at },
          {
            key: "actions", header: "", align: "right",
            render: (s: StorageVolumeDetail) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" data-testid={`snapshot-restore-${ref.name}-${s.name}`} onClick={() => setSnapRestoreTarget({ ...ref, snap: s.name })}>Restore</Button>
                <Button size="sm" variant="ghost" data-testid={`snapshot-delete-${ref.name}-${s.name}`} onClick={() => setSnapDeleteTarget({ ...ref, snap: s.name })}><Trash2 size={13} /> Delete</Button>
              </div>
            ),
          },
        ]}
        rows={list}
        rowKey={(s) => s.name}
        emptyMessage="No snapshots"
      />
    </div>
  );

  const renderVolumeTable = (poolName: string, list: StorageVolume[]) => (
    <div className="space-y-2">
      <Table
        dataTestId={`volume-table-${poolName}`}
        columns={[
          { key: "name", header: "Name", render: (v: StorageVolume) => v.name },
          { key: "type", header: "Type", render: (v: StorageVolume) => v.type },
          { key: "content", header: "Content type", render: (v: StorageVolume) => v.content_type },
          {
            key: "actions", header: "", align: "right",
            render: (v: StorageVolume) => {
              const ref = { pool: poolName, type: v.type, name: v.name };
              return (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" data-testid={`volume-edit-${v.name}`} onClick={() => openEdit(ref)}><Pencil size={13} /> Edit</Button>
                  <Button size="sm" variant="ghost" data-testid={`volume-resize-${v.name}`} onClick={() => openResize(ref)}>Resize</Button>
                  <Button size="sm" variant="ghost" data-testid={`volume-rename-${v.name}`} onClick={() => openRename(ref)}>Rename</Button>
                  <Button size="sm" variant="ghost" data-testid={`volume-snapshots-${v.name}`} onClick={() => toggleSnapshots(ref)}><Camera size={13} /> Snapshots</Button>
                  <Button size="sm" variant="ghost" data-testid={`volume-attach-${v.name}`} onClick={() => openAttach(ref)}><HardDrive size={13} /> Attach</Button>
                  <Button size="sm" variant="ghost" data-testid={`volume-delete-${v.name}`} onClick={() => setDeleteVolumeTarget(ref)}><Trash2 size={13} /> Delete</Button>
                </div>
              );
            },
          },
        ]}
        rows={list}
        rowKey={(v) => v.name}
        emptyMessage="No volumes"
      />
      {list.map((v) => snapshotOpen[snapshotKey({ pool: poolName, type: v.type, name: v.name })] && (
        <div key={`snaps-${v.name}`}>{renderSnapshotTable({ pool: poolName, type: v.type, name: v.name }, snapshots[snapshotKey({ pool: poolName, type: v.type, name: v.name })] ?? [])}</div>
      ))}
    </div>
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
          <Button size="sm" variant="ghost" data-testid={`pool-volumes-${p.name}`} onClick={() => void toggleVolumes(p.name)}><Database size={14} /> Volumes</Button>
          <Button size="sm" variant="ghost" data-testid={`pool-delete-${p.name}`} onClick={() => setDeletePoolTarget(p)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}><Trash2 size={14} /> Delete</Button>,
      <Button key="iso" size="sm" data-testid="iso-import" onClick={() => { setIsoPool(pools[0]?.name ?? ""); setIsoFile(null); setIsoError(""); setIsoOpen(true); }}><Disc size={14} /> Import ISO</Button>,
      <Button key="create" size="sm" data-testid="pool-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create pool</Button>,
    ],
    [selectedKeys, setDeleteManyOpen, setCreateOpen, pools]
  );

  useEffect(() => {
    registerBar?.({ title: "Storage pools", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="storage-page">
      {!registerBar && <PageBar title="Storage pools" actions={barActions} />}

      {pools.length === 0 ? (
        <EmptyState title="No storage pools" />
      ) : (
        <Table columns={columns} rows={pools} rowKey={(p) => p.name} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      )}

      {Object.entries(volumes).map(([poolName, list]) => (
        <div key={poolName} className="rounded border border-border bg-surface-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Volumes in {poolName}</h2>
            <Button size="sm" data-testid={`volume-create-${poolName}`} onClick={() => openVolumeCreate(poolName)}><Plus size={13} /> Create volume</Button>
          </div>
          {renderVolumeTable(poolName, list)}
        </div>
      ))}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create storage pool" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="pool-create-submit"><Plus size={14} /> Create</Button>
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

      <Dialog open={volumeCreatePool !== null} onClose={() => setVolumeCreatePool(null)} title="Create volume" footer={
        <>
          <Button variant="secondary" onClick={() => setVolumeCreatePool(null)}><X size={14} /> Cancel</Button>
          <Button onClick={createVolume} loading={busy} data-testid="volume-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="volume-name" data-testid="volume-name" value={volumeName} onChange={(e) => setVolumeName(e.target.value)} />
          <Select label="Content type" name="volume-content-type" data-testid="volume-content-type" value={volumeContentType} onChange={(e) => setVolumeContentType(e.target.value)}>
            <option value="filesystem">filesystem</option>
            <option value="block">block</option>
          </Select>
          <Input label="Size (e.g. 10GB)" name="volume-size" data-testid="volume-size" value={volumeSize} onChange={(e) => setVolumeSize(e.target.value)} />
          <KeyValueEditor values={volumeConfig} onChange={setVolumeConfig} dataTestId="volume-config" />
          {volumeError && <p className="text-xs text-red-300" data-testid="volume-error">{volumeError}</p>}
        </div>
      </Dialog>

      <Dialog open={editTarget !== null} onClose={() => setEditTarget(null)} title={`Edit volume ${editTarget?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditTarget(null)}><X size={14} /> Cancel</Button>
          <Button onClick={saveEdit} loading={busy} data-testid="volume-edit-save"><Plus size={14} /> Save</Button>
        </>
      }>
        <div className="space-y-3">
          <Select label="Content type" name="volume-edit-content-type" data-testid="volume-edit-content-type" value={editContentType} onChange={(e) => setEditContentType(e.target.value)}>
            <option value="filesystem">filesystem</option>
            <option value="block">block</option>
            <option value="iso">iso</option>
          </Select>
          <KeyValueEditor values={editConfig} onChange={setEditConfig} dataTestId="volume-edit-config" />
        </div>
      </Dialog>

      <Dialog open={resizeTarget !== null} onClose={() => setResizeTarget(null)} title={`Resize volume ${resizeTarget?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setResizeTarget(null)}><X size={14} /> Cancel</Button>
          <Button onClick={resizeVolume} loading={busy} data-testid="volume-resize-submit"><Plus size={14} /> Resize</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label={`New size (current: ${resizeTarget?.currentSize || "unknown"})`} name="volume-resize-size" data-testid="volume-resize-size" value={resizeSize} onChange={(e) => setResizeSize(e.target.value)} />
          {resizeError && <p className="text-xs text-red-300" data-testid="resize-error">{resizeError}</p>}
        </div>
      </Dialog>

      <Dialog open={renameTarget !== null} onClose={() => setRenameTarget(null)} title={`Rename volume ${renameTarget?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setRenameTarget(null)}><X size={14} /> Cancel</Button>
          <Button onClick={renameVolume} loading={busy} data-testid="volume-rename-submit"><Plus size={14} /> Rename</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="New name" name="volume-rename-name" data-testid="volume-rename-name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          {renameError && <p className="text-xs text-red-300" data-testid="rename-error">{renameError}</p>}
        </div>
      </Dialog>

      <Dialog open={snapCreateTarget !== null} onClose={() => setSnapCreateTarget(null)} title={`Create snapshot of ${snapCreateTarget?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setSnapCreateTarget(null)}><X size={14} /> Cancel</Button>
          <Button onClick={createSnapshot} loading={busy} data-testid="snapshot-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <Input label="Snapshot name" name="snapshot-name" data-testid="snapshot-name" value={snapName} onChange={(e) => setSnapName(e.target.value)} />
      </Dialog>

      <Dialog open={attachTarget !== null} onClose={() => setAttachTarget(null)} title={`Attach volume ${attachTarget?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setAttachTarget(null)}><X size={14} /> Cancel</Button>
          <Button onClick={attachVolume} loading={busy} disabled={!attachInstance} data-testid="volume-attach-submit"><Plus size={14} /> Attach</Button>
        </>
      }>
        <Select label="Instance" name="attach-instance" data-testid="attach-instance" value={attachInstance} onChange={(e) => setAttachInstance(e.target.value)}>
          <option value="">Select an instance</option>
          {instances.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
        </Select>
      </Dialog>

      <Dialog open={isoOpen} onClose={() => setIsoOpen(false)} title="Import ISO" footer={
        <>
          <Button variant="secondary" onClick={() => setIsoOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={importIso} loading={busy} disabled={!isoFile} data-testid="iso-import-submit"><Plus size={14} /> Import</Button>
        </>
      }>
        <div className="space-y-3">
          <Select label="Pool" name="iso-pool" data-testid="iso-pool" value={isoPool} onChange={(e) => setIsoPool(e.target.value)}>
            {pools.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </Select>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">ISO file</span>
            <input type="file" accept=".iso,application/x-iso9660-image" data-testid="iso-file" ref={fileRef} onChange={(e) => { setIsoFile(e.target.files?.[0] ?? null); setIsoError(""); }} className="text-sm text-text-primary" />
          </label>
          {isoError && <p className="text-xs text-red-300" data-testid="iso-error">{isoError}</p>}
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
        open={deleteManyOpen}
        title="Delete pools"
        body={`Delete ${selectedKeys.length} selected pool(s)?`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletingMany}
        onConfirm={removeMany}
        onCancel={() => setDeleteManyOpen(false)}
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
      <ConfirmDialog
        open={snapRestoreTarget !== null}
        title="Restore snapshot"
        body={`Restore volume ${snapRestoreTarget?.name} from snapshot ${snapRestoreTarget?.snap}? Current data will be replaced.`}
        confirmLabel="Restore"
        onConfirm={restoreSnapshot}
        onCancel={() => setSnapRestoreTarget(null)}
      />
      <ConfirmDialog
        open={snapDeleteTarget !== null}
        title="Delete snapshot"
        body={`Delete snapshot ${snapDeleteTarget?.snap} of ${snapDeleteTarget?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removeSnapshot}
        onCancel={() => setSnapDeleteTarget(null)}
      />
    </div>
  );
}
