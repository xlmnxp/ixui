import { useEffect, useState } from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Checkbox } from "./checkbox";
import { toast } from "./toast";
import { instancesApi, infraApi, clusterApi, operationsApi } from "../api";
import { validateInstanceName } from "../lib/instance-name";
import { loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { ClusterMember, Project, StoragePool } from "../api/types";

export interface RenameInstanceDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  project?: string;
  onRenamed?: (newName: string) => void;
}

export function RenameInstanceDialog({ open, onClose, name, project, onRenamed }: RenameInstanceDialogProps) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewName(name);
    setBusy(false);
  }, [open, name]);

  const error = validateInstanceName(newName);
  const valid = error === null;

  const submit = async () => {
    if (!valid) return;
    if (newName.trim() === name) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const result = await instancesApi.rename(name, newName.trim(), project);
      // Rename is async: wait for the operation so the list reload below sees
      // the new name instead of racing the in-flight rename.
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Rename failed");
      }
      toast("success", `Renamed ${name} to ${newName.trim()}`);
      void loadInstances(currentProjectStore.getState()).catch(() => {});
      onRenamed?.(newName.trim());
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Rename failed");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Rename ${name}`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="rename-cancel">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!valid} loading={busy} data-testid="rename-confirm">Rename</Button>
        </>
      }
    >
      <Input label="New name" name="rename-name" data-testid="rename-name" value={newName} onChange={(e) => setNewName(e.target.value)} error={newName && error ? error : undefined} />
    </Dialog>
  );
}

export interface CopyInstanceDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  project?: string;
  defaultPool?: string;
}

export function CopyInstanceDialog({ open, onClose, name, project, defaultPool }: CopyInstanceDialogProps) {
  const selectedProject = useStore(currentProjectStore);
  const [target, setTarget] = useState("");
  const [live, setLive] = useState(false);
  const [pool, setPool] = useState("");
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget("");
    setLive(false);
    setPool("");
    setBusy(false);
    void infraApi
      .listPools()
      .then((list) => {
        setPools(list);
        if (defaultPool && list.some((p) => p.name === defaultPool)) setPool(defaultPool);
      })
      .catch(() => setPools([]));
  }, [open, defaultPool]);

  const error = validateInstanceName(target);
  const valid = error === null;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await instancesApi.copy(name, target.trim(), { live, ...(pool ? { pool } : {}), sourceProject: project, targetProject: project });
      toast("success", `Copied ${name} to ${target.trim()}`);
      void loadInstances(selectedProject).catch(() => {});
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Copy failed");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Copy ${name}`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="copy-cancel">Cancel</Button>
          <Button size="sm" onClick={submit} disabled={!valid} loading={busy} data-testid="copy-confirm">Copy</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="New name" name="copy-name" data-testid="copy-name" value={target} onChange={(e) => setTarget(e.target.value)} error={target && error ? error : undefined} />
        <Checkbox label="Live (preserve running state)" data-testid="copy-live" checked={live} onChange={(e) => setLive(e.target.checked)} />
        <Select label="Storage pool" name="copy-pool" data-testid="copy-pool" value={pool} onChange={(e) => setPool(e.target.value)}>
          <option value="">— default —</option>
          {pools.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </Select>
      </div>
    </Dialog>
  );
}

export interface MoveInstanceDialogProps {
  open: boolean;
  onClose: () => void;
  name: string;
  sourceProject?: string;
  currentMember?: string;
  onMoved?: (project: string) => void;
}

export function MoveInstanceDialog({ open, onClose, name, sourceProject, currentMember, onMoved }: MoveInstanceDialogProps) {
  const [project, setProject] = useState("");
  const [member, setMember] = useState("");
  const [live, setLive] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProject("");
    setMember("");
    setLive(false);
    setBusy(false);
    void Promise.all([infraApi.listProjects(), clusterApi.listMembers()])
      .then(([projs, mems]) => {
        setProjects(projs);
        setMembers(mems);
      })
      .catch(() => {});
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const body: { live?: boolean; project?: string; target?: string } = {};
      if (live) body.live = true;
      if (project) body.project = project;
      if (member) body.target = member;
      await instancesApi.move(name, body, sourceProject);
      toast("success", `Move of ${name} requested`);
      void loadInstances(currentProjectStore.getState()).catch(() => {});
      onMoved?.(project);
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Move failed");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Move ${name}`}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose} data-testid="move-cancel">Cancel</Button>
          <Button size="sm" onClick={submit} loading={busy} data-testid="move-confirm">Move</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Project" name="move-project" data-testid="move-project" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">— current project —</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </Select>
        <Select label="Target member" name="move-member" data-testid="move-member" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">— any member —</option>
          {members.filter((m) => m.server_name !== currentMember).map((m) => (
            <option key={m.server_name} value={m.server_name}>{m.server_name}</option>
          ))}
        </Select>
        <Checkbox label="Live migration" data-testid="move-live" checked={live} onChange={(e) => setLive(e.target.checked)} />
      </div>
    </Dialog>
  );
}
