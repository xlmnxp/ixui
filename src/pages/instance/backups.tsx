import { useCallback, useEffect, useState } from "react";
import { Check, Download, Trash2, X } from "lucide-react";
import { backupsApi, operationsApi } from "../../api";
import type { Backup } from "../../api/backups";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Button } from "../../components/button";
import { Dialog } from "../../components/dialog";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Input } from "../../components/input";
import { Switch } from "../../components/switch";
import { EmptyState } from "../../components/empty-state";
import { Loading } from "../../components/loading";
import { toast } from "../../components/toast";

export interface BackupsTabProps {
  instanceName: string;
  project?: string;
  registerActions?: (actions: BackupsActions | null) => void;
}

export interface BackupsActions {
  create: () => void;
}

const defaultName = (): string => `backup-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}`;

export function BackupsTab({ instanceName, project, registerActions }: BackupsTabProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [instanceOnly, setInstanceOnly] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void backupsApi
      .list(instanceName, project)
      .then(setBackups)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [instanceName, project]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    registerActions?.({
      create: () => {
        setName(defaultName());
        setCreateOpen(true);
      },
    });
    return () => registerActions?.(null);
  }, [registerActions]);

  const create = async () => {
    setBusy(true);
    try {
      const result = await backupsApi.create(instanceName, name.trim(), { instance_only: instanceOnly, optimized_storage: optimized }, project);
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Backup failed");
      }
      toast("success", `Backup ${name.trim()} created`);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (backup: string) => {
    setDownloading(backup);
    try {
      const res = await fetch(backupsApi.exportUrl(instanceName, backup, project), { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const objectUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${instanceName}-${backup}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await backupsApi.delete(instanceName, deleteTarget, project);
      toast("success", `Deleted backup ${deleteTarget}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Backup>[] = [
    { key: "name", header: "Name", sortValue: (b) => b.name, render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "created", header: "Created", sortValue: (b) => b.created_at, render: (b) => new Date(b.created_at).toLocaleString() },
    { key: "expires", header: "Expires", render: (b) => (b.expires_at && !b.expires_at.startsWith("0001") ? new Date(b.expires_at).toLocaleString() : "Never") },
    { key: "scope", header: "Contents", render: (b) => (b.instance_only ? "Instance only" : "With snapshots") },
    {
      key: "actions", header: "", align: "right",
      render: (b) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`backup-download-${b.name}`} loading={downloading === b.name} onClick={() => void download(b.name)}><Download size={14} /> Download</Button>
          <Button size="sm" variant="ghost" data-testid={`backup-delete-${b.name}`} onClick={() => setDeleteTarget(b.name)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  if (!loaded) return <Loading dataTestId="backups-tab" label="Loading backups…" />;

  return (
    <div data-testid="backups-tab">
      {backups.length === 0 ? (
        <EmptyState title="No backups" description="Backups are portable archives you can download and import on any Incus server." />
      ) : (
        <Table columns={columns} rows={backups} rowKey={(b) => b.name} persistKey="backups" />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create backup"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={create} loading={busy} disabled={!name.trim()} data-testid="backup-create-submit"><Check size={14} /> Create</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" name="backup-name" data-testid="backup-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Switch checked={instanceOnly} onChange={setInstanceOnly} label="Instance only (exclude snapshots)" />
          <Switch checked={optimized} onChange={setOptimized} label="Optimized storage format" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete backup"
        body={`Delete backup ${deleteTarget}? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
