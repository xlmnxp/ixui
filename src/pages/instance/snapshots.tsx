import { useCallback, useEffect, useState } from "react";
import { Check, Clock, RotateCcw, Trash2, X } from "lucide-react";
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
import { Loading } from "../../components/loading";
import { toast } from "../../components/toast";
import { useStore } from "../../state/store";
import { metadataStore, loadMetadata, configDescription } from "../../state/metadata";

export interface SnapshotsTabProps {
  instanceName: string;
  project?: string;
  registerActions?: (actions: SnapshotsActions | null) => void;
}

export interface SnapshotsActions {
  create: () => void;
}

export function SnapshotsTab({ instanceName, project, registerActions }: SnapshotsTabProps) {
  const [snapshots, setSnapshots] = useState<Instance[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stateful, setStateful] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [expiry, setExpiry] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const metadataDescriptions = useStore(metadataStore);

  useEffect(() => {
    registerActions?.({ create: () => setCreateOpen(true) });
    return () => registerActions?.(null);
  }, [registerActions]);

  useEffect(() => {
    loadMetadata();
    void instancesApi
      .get(instanceName, project)
      .then((i) => {
        setSchedule(i.config["snapshots.schedule"] ?? "");
        setExpiry(i.config["snapshots.expiry"] ?? "");
        setHasConfig(true);
      })
      .catch(() => {});
  }, [instanceName, project]);

  const saveSchedule = async () => {
    setScheduleBusy(true);
    try {
      const current = await instancesApi.get(instanceName, project);
      const config = { ...current.config };
      const s = schedule.trim();
      const e = expiry.trim();
      if (s) config["snapshots.schedule"] = s;
      else delete config["snapshots.schedule"];
      if (e) config["snapshots.expiry"] = e;
      else delete config["snapshots.expiry"];
      await instancesApi.update(instanceName, { config }, project);
      toast("success", "Snapshot schedule saved");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setScheduleBusy(false);
    }
  };

  const refresh = useCallback(() => {
    void instancesApi
      .listSnapshots(instanceName, project)
      .then((list) => setSnapshots(list))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [instanceName, project]);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await instancesApi.createSnapshot(instanceName, name.trim(), stateful, project);
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
      await instancesApi.restoreSnapshot(instanceName, restoreName, project);
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
      await instancesApi.deleteSnapshot(instanceName, snapName, project);
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
          <Button size="sm" variant="ghost" data-testid={`snap-restore-${s.name}`} onClick={() => setRestoreName(s.name)}><RotateCcw size={14} /> Restore</Button>
          <Button size="sm" variant="ghost" data-testid={`snap-delete-${s.name}`} onClick={() => remove(s.name)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  if (!loaded) return <Loading dataTestId="snapshots-tab" label="Loading snapshots…" />;

  return (
    <div className="space-y-4" data-testid="snapshots-tab">
      {hasConfig && (
        <div className="rounded border border-border bg-surface-900 p-3" data-testid="snapshot-schedule">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <Clock size={13} /> Automatic snapshots
            </h3>
            <Button size="sm" loading={scheduleBusy} data-testid="schedule-save" onClick={() => void saveSchedule()}><Check size={13} /> Save</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Input label="Schedule (cron)" name="snap-schedule" data-testid="schedule-input" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="@daily" />
              {configDescription(metadataDescriptions, "snapshots.schedule") && (
                <p className="mt-1 text-[11px] text-text-tertiary" data-testid="schedule-hint">{configDescription(metadataDescriptions, "snapshots.schedule")}</p>
              )}
            </div>
            <div>
              <Input label="Expiry" name="snap-expiry" data-testid="expiry-input" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="1d" />
              {configDescription(metadataDescriptions, "snapshots.expiry") && (
                <p className="mt-1 text-[11px] text-text-tertiary" data-testid="expiry-hint">{configDescription(metadataDescriptions, "snapshots.expiry")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {snapshots.length === 0 ? (
        <EmptyState title="No snapshots" description="Snapshots let you roll back to a previous state." />
      ) : (
        <Table columns={columns} rows={snapshots} rowKey={(s) => s.name} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create snapshot" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="snap-create-submit"><Check size={14} /> Create</Button>
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
