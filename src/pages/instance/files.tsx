import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Download, FilePlus2, FolderPlus, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { filesApi } from "../../api";
import type { FileEntry } from "../../api/files";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Button } from "../../components/button";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Dialog } from "../../components/dialog";
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { EmptyState } from "../../components/empty-state";
import { toast } from "../../components/toast";
import { formatBytes } from "../../lib/format";

export interface FilesTabProps {
  instanceName: string;
  project?: string;
}

export function joinPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

export function parentOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "/";
  const idx = trimmed.lastIndexOf("/");
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

export function basenameOf(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed.split("/").pop() ?? "";
}

export function FilesTab({ instanceName, project }: FilesTabProps) {
  const [cwd, setCwd] = useState("/");
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newName, setNewName] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    void filesApi
      .read(instanceName, cwd, project)
      .then((result) => {
        if (Array.isArray(result)) setEntries(result);
        else {
          // Path turned out to be a file — open it for editing.
          setEditPath(cwd);
          setEditContent(result);
          setEntries([]);
        }
      })
      .catch(() => {
        setEntries([]);
        toast("danger", `Cannot list ${cwd}`);
      });
  }, [instanceName, cwd, project]);

  useEffect(refresh, [refresh]);

  const openFile = async (entry: FileEntry) => {
    const path = joinPath(cwd, entry.name);
    if (entry.type === "directory") {
      setCwd(path);
      return;
    }
    try {
      const result = await filesApi.read(instanceName, path, project);
      setEditPath(path);
      setEditContent(typeof result === "string" ? result : JSON.stringify(result, null, 2));
    } catch {
      toast("danger", `Cannot read ${entry.name}`);
    }
  };

  const saveFile = async () => {
    if (editPath === null) return;
    if (newOpen && !editPath.trim()) {
      toast("danger", "File name is required");
      return;
    }
    setBusy(true);
    try {
      if (newOpen) {
        await filesApi.create(instanceName, cwd, editPath, editContent, project);
        toast("success", `Created ${editPath}`);
      } else {
        await filesApi.put(instanceName, editPath, editContent, project);
        toast("success", `Saved ${basenameOf(editPath)}`);
      }
      setEditPath(null);
      setNewOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (entry: FileEntry) => {
    const path = joinPath(cwd, entry.name);
    try {
      const res = await fetch(filesApi.downloadUrl(instanceName, path, project), { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Download failed");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await filesApi.remove(instanceName, deleteTarget, project);
      toast("success", `Deleted ${basenameOf(deleteTarget)}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await filesApi.create(instanceName, cwd, file.name, file, project);
      toast("success", `Uploaded ${file.name}`);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const createDirectory = async () => {
    const name = mkdirName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await filesApi.mkdir(instanceName, cwd, name, project);
      toast("success", `Created directory ${name}`);
      setMkdirOpen(false);
      setMkdirName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...(entries ?? [])].sort((a, b) => {
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (b.type === "directory" && a.type !== "directory") return 1;
    return a.name.localeCompare(b.name);
  });

  const columns: Column<FileEntry>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (e) => e.name,
      render: (e) => (
        <button
          type="button"
          data-testid={`file-row-${e.name}`}
          onClick={() => void openFile(e)}
          className="font-mono text-xs text-accent-300 hover:underline"
        >
          {e.name}
        </button>
      ),
    },
    { key: "type", header: "Type", sortValue: (e) => e.type, render: (e) => e.type },
    {
      key: "size",
      header: "Size",
      sortValue: (e) => e.size ?? 0,
      render: (e) => (e.size !== undefined ? formatBytes(e.size) : "—"),
    },
    {
      key: "modified",
      header: "Modified",
      render: (e) => (e.modify_time ? new Date(e.modify_time).toLocaleString() : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (e) => (
        <div className="flex justify-end gap-1">
          {e.type !== "directory" && (
            <>
              <Button size="sm" variant="ghost" data-testid={`file-edit-${e.name}`} onClick={() => void openFile(e)}><Pencil size={14} /> Edit</Button>
              <Button size="sm" variant="ghost" data-testid={`file-download-${e.name}`} onClick={() => void download(e)}><Download size={14} /> Download</Button>
            </>
          )}
          <Button size="sm" variant="ghost" data-testid={`file-delete-${e.name}`} onClick={() => setDeleteTarget(joinPath(cwd, e.name))}><Trash2 size={14} /></Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 p-3" data-testid="files-tab">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" data-testid="files-up" disabled={cwd === "/"} onClick={() => setCwd(parentOf(cwd))}><ArrowUp size={14} /> Up</Button>
        <Button size="sm" variant="ghost" data-testid="files-refresh" onClick={refresh}><RefreshCw size={14} /> Refresh</Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button size="sm" variant="ghost" data-testid="files-new-file" onClick={() => { setNewOpen(true); setNewName(""); setEditContent(""); setEditPath(""); }}><FilePlus2 size={14} /> New file</Button>
        <Button size="sm" variant="ghost" data-testid="files-new-dir" onClick={() => { setMkdirOpen(true); setMkdirName(""); }}><FolderPlus size={14} /> New folder</Button>
        <Button size="sm" variant="ghost" data-testid="files-upload" onClick={() => uploadRef.current?.click()}><Upload size={14} /> Upload</Button>
        <input ref={uploadRef} type="file" data-testid="files-upload-input" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        <span className="ml-auto font-mono text-xs text-text-tertiary" data-testid="files-cwd">{cwd}</span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="Empty directory" description="No files or folders here." />
      ) : (
        <Table columns={columns} rows={sorted} rowKey={(e) => e.name} dataTestId="files-table" />
      )}

      <Dialog
        open={editPath !== null}
        onClose={() => setEditPath(null)}
        title={newOpen ? "New file" : `Edit ${basenameOf(editPath ?? "")}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditPath(null); setNewOpen(false); }}><X size={14} /> Cancel</Button>
            <Button onClick={() => void saveFile()} loading={busy} data-testid="file-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          {newOpen && (
            <Input label="File name" name="file-new-name" data-testid="file-new-name" value={newName} onChange={(e) => { setNewName(e.target.value); setEditPath(e.target.value.trim()); }} />
          )}
          <Textarea label="Content" name="file-content" data-testid="file-content" value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={14} className="font-mono text-xs" />
        </div>
      </Dialog>

      <Dialog
        open={mkdirOpen}
        onClose={() => setMkdirOpen(false)}
        title="New folder"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMkdirOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={() => void createDirectory()} loading={busy} data-testid="mkdir-submit"><Check size={14} /> Create</Button>
          </>
        }
      >
        <Input label="Folder name" name="mkdir-name" data-testid="mkdir-name" value={mkdirName} onChange={(e) => setMkdirName(e.target.value)} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${basenameOf(deleteTarget ?? "")}`}
        body="This removes the entry from the instance filesystem. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={busy}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
