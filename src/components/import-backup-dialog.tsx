import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { infraApi, instancesApi, operationsApi } from "../api";
import type { StoragePool } from "../api/types";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { Select } from "./select";
import { toast } from "./toast";
import { loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { ALL_PROJECTS } from "../api/client";

export interface ImportBackupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportBackupDialog({ open, onClose }: ImportBackupDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [pool, setPool] = useState("");
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setName("");
    setPool("");
    setError("");
    void infraApi.listPools().then(setPools).catch(() => setPools([]));
  }, [open]);

  const submit = async () => {
    if (!file) {
      setError("Choose a backup archive (.tar.gz)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const project = currentProjectStore.getState();
      const result = await instancesApi.importBackup(
        file,
        { name: name.trim() || undefined, pool: pool || undefined },
        project === ALL_PROJECTS ? "default" : project,
      );
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Import failed");
      }
      toast("success", `Imported ${name.trim() || file.name}`);
      void loadInstances(project).catch(() => {});
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import instance from backup"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}><X size={14} /> Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!file} data-testid="import-submit"><Upload size={14} /> Import</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-secondary">Backup archive</span>
          <input
            ref={fileRef}
            type="file"
            accept=".tar.gz,.tgz,.tar.xz,.tar.zst,.tar,application/gzip,application/x-gzip"
            data-testid="import-file"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }}
            className="text-sm text-text-primary"
          />
        </label>
        <Input label="Instance name (optional — defaults to the name in the backup)" name="import-name" data-testid="import-name" value={name} onChange={(e) => setName(e.target.value)} />
        <Select label="Storage pool (optional)" name="import-pool" data-testid="import-pool" value={pool} onChange={(e) => setPool(e.target.value)}>
          <option value="">Default from backup</option>
          {pools.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </Select>
        {error && <p role="alert" className="text-xs text-red-300" data-testid="import-error">{error}</p>}
      </div>
    </Dialog>
  );
}
