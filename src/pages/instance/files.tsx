import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, FilePlus2, FolderPlus, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { filesApi } from "../../api";
import type { FileStat } from "../../api/files";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Button } from "../../components/button";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Dialog } from "../../components/dialog";
import { Input } from "../../components/input";
import { Textarea } from "../../components/textarea";
import { EmptyState } from "../../components/empty-state";
import { Loading } from "../../components/loading";
import { toast } from "../../components/toast";
import { ExplorerNavbar } from "../../components/explorer-nav";
import { FileEntryIcon, fileTypeLabel } from "../../components/file-entry-icon";
import { formatBytes } from "../../lib/format";
import { basenameOf, joinPath, parentOf, resolveLinkTarget } from "../../lib/path";

export { basenameOf, joinPath, normalizeTypedPath, parentOf } from "../../lib/path";

/** Cap the per-refresh stat sweep so huge directories don't fan out too far. */
const MAX_STAT_SWEEP = 200;

const UNKNOWN_STAT: FileStat = { type: null, size: null, modified: null };

export interface FilesTabProps {
  instanceName: string;
  project?: string;
}

export function FilesTab({ instanceName, project }: FilesTabProps) {
  const [cwd, setCwd] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [entries, setEntries] = useState<string[] | null>(null);
  const [sweepDone, setSweepDone] = useState(false);
  const [stats, setStats] = useState<Record<string, FileStat>>({});
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newName, setNewName] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const navbarWrapRef = useRef<HTMLDivElement>(null);
  const [navbarHeight, setNavbarHeight] = useState(47);

  // Measure the rendered navbar so the table header pins exactly below it
  // (the height changes when the inline path error row appears).
  useEffect(() => {
    const el = navbarWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setNavbarHeight(el.offsetHeight || 47);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const navigateTo = useCallback((path: string) => {
    if (history[historyIndex] === path) return;
    const next = [...history.slice(0, historyIndex + 1), path];
    setHistory(next);
    setHistoryIndex(next.length - 1);
    setCwd(path);
  }, [history, historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    setHistoryIndex(idx);
    setCwd(history[idx] ?? "/");
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    setHistoryIndex(idx);
    setCwd(history[idx] ?? "/");
  }, [history, historyIndex]);

  const commitPath = useCallback(async (path: string) => {
    if (path === cwd) return;
    try {
      const result = await filesApi.read(instanceName, path, project);
      if (Array.isArray(result)) {
        navigateTo(path);
      } else {
        // The path points at a file: jump to its parent and open it in the editor.
        navigateTo(parentOf(path));
        setEditPath(path);
        setEditContent(result);
      }
    } catch {
      throw new Error(`Path not found: ${path}`);
    }
  }, [cwd, navigateTo, instanceName, project]);

  const sweepStats = useCallback((dir: string, names: string[]) => {
    setSweepDone(false);
    void Promise.all(
      names.slice(0, MAX_STAT_SWEEP).map(async (name) => {
        try {
          return [name, await filesApi.stat(instanceName, joinPath(dir, name), project)] as const;
        } catch {
          return [name, UNKNOWN_STAT] as const;
        }
      })
    ).then((pairs) => {
      const next: Record<string, FileStat> = {};
      for (const [name, stat] of pairs) next[name] = stat;
      setStats(next);
      setSweepDone(true);
    });
  }, [instanceName, project]);

  const refresh = useCallback(() => {
    void filesApi
      .read(instanceName, cwd, project)
      .then((result) => {
        if (Array.isArray(result)) {
          setEntries(result);
          sweepStats(cwd, result);
        } else {
          // Path turned out to be a file — open it for editing.
          setEditPath(cwd);
          setEditContent(result);
          setEntries([]);
          setSweepDone(true);
        }
      })
      .catch(() => {
        setEntries([]);
        setSweepDone(true);
        toast("danger", `Cannot list ${cwd}`);
      });
  }, [instanceName, cwd, project, sweepStats]);

  useEffect(refresh, [refresh]);

  const openEntry = async (name: string) => {
    const path = joinPath(cwd, name);
    let type = stats[name]?.type ?? null;
    // Unknown entries (stat sweep failures or beyond the cap): stat on demand.
    if (type === null) {
      const stat = await filesApi.stat(instanceName, path, project).catch(() => null);
      type = stat?.type ?? null;
      setStats((prev) => ({ ...prev, [name]: { ...(prev[name] ?? UNKNOWN_STAT), type } }));
    }
    if (type === "directory") {
      navigateTo(path);
      return;
    }
    try {
      const result = await filesApi.read(instanceName, path, project);
      if (Array.isArray(result)) {
        navigateTo(path);
        return;
      }
      if (type === "symlink") {
        // The read returned the link target as text; follow it to the real path.
        const target = resolveLinkTarget(path, result);
        const targetResult = await filesApi.read(instanceName, target, project);
        if (Array.isArray(targetResult)) {
          navigateTo(target);
        } else {
          setEditPath(target);
          setEditContent(targetResult);
        }
        return;
      }
      setEditPath(path);
      setEditContent(result);
    } catch {
      toast("danger", `Cannot read ${name}`);
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

  const download = async (name: string) => {
    const path = joinPath(cwd, name);
    try {
      const res = await fetch(filesApi.downloadUrl(instanceName, path, project), { credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = name;
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
    const aDir = stats[a]?.type === "directory";
    const bDir = stats[b]?.type === "directory";
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.localeCompare(b);
  });

  const columns: Column<string>[] = [
    {
      key: "name",
      header: "Name",
      sortValue: (e) => e,
      render: (name) => (
        <span className="flex items-center gap-2">
          <span data-testid={`entry-icon-${name}`} data-type={stats[name]?.type ?? "unknown"}><FileEntryIcon type={stats[name]?.type ?? null} /></span>
          <button
            type="button"
            data-testid={`file-row-${name}`}
            onClick={() => void openEntry(name)}
            className="font-mono text-xs text-accent-300 hover:underline"
          >
            {name}
          </button>
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortValue: (e) => stats[e]?.type ?? "",
      render: (name) => fileTypeLabel(stats[name]?.type ?? null),
    },
    {
      key: "size",
      header: "Size",
      sortValue: (e) => stats[e]?.size ?? -1,
      render: (name) => {
        const size = stats[name]?.size;
        return size !== null && size !== undefined ? formatBytes(size) : "—";
      },
    },
    {
      key: "modified",
      header: "Modified",
      render: (name) => {
        const modified = stats[name]?.modified;
        return modified ? new Date(modified).toLocaleString() : "—";
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (name) => {
        const isDir = stats[name]?.type === "directory";
        return (
          <div className="flex justify-end gap-1">
            {!isDir && (
              <>
                <Button size="sm" variant="ghost" data-testid={`file-edit-${name}`} onClick={() => void openEntry(name)}><Pencil size={14} /> Edit</Button>
                <Button size="sm" variant="ghost" data-testid={`file-download-${name}`} onClick={() => void download(name)}><Download size={14} /> Download</Button>
              </>
            )}
            <Button size="sm" variant="ghost" data-testid={`file-delete-${name}`} onClick={() => setDeleteTarget(joinPath(cwd, name))}><Trash2 size={14} /></Button>
          </div>
        );
      },
    },
  ];

  if (entries === null || !sweepDone) return <Loading dataTestId="files-tab" label="Loading files…" />;

  return (
    <div data-testid="files-tab">
      <ExplorerNavbar
        rootRef={navbarWrapRef}
        cwd={cwd}
        canBack={historyIndex > 0}
        canForward={historyIndex < history.length - 1}
        onBack={goBack}
        onForward={goForward}
        onUp={() => navigateTo(parentOf(cwd))}
        onNavigate={navigateTo}
        onCommitPath={commitPath}
        actions={
          <>
            <Button size="sm" variant="ghost" data-testid="files-new-file" onClick={() => { setNewOpen(true); setNewName(""); setEditContent(""); setEditPath(""); }}><FilePlus2 size={14} /> New file</Button>
            <Button size="sm" variant="ghost" data-testid="files-new-dir" onClick={() => { setMkdirOpen(true); setMkdirName(""); }}><FolderPlus size={14} /> New folder</Button>
            <Button size="sm" variant="ghost" data-testid="files-upload" onClick={() => uploadRef.current?.click()}><Upload size={14} /> Upload</Button>
            <Button size="sm" variant="ghost" data-testid="files-refresh" onClick={refresh}><RefreshCw size={14} /></Button>
            <input ref={uploadRef} type="file" data-testid="files-upload-input" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          </>
        }
      />

      {sorted.length === 0 ? (
        <div className="px-3 pb-3">
          <EmptyState title="Empty directory" description="No files or folders here." />
        </div>
      ) : (
        <Table columns={columns} rows={sorted} rowKey={(e) => e} dataTestId="files-table" stickyHeaderOffset={navbarHeight} />
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
