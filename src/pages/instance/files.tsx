import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, Download, File, FilePlus2, FileText, Folder, FolderPlus, Link2, Pencil, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { filesApi } from "../../api";
import type { FileEntryType, FileStat } from "../../api/files";
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

/** Cap the per-refresh stat sweep so huge directories don't fan out too far. */
const MAX_STAT_SWEEP = 200;

const UNKNOWN_STAT: FileStat = { type: null, size: null, modified: null };

function entryIcon(type: FileEntryType | null) {
  if (type === "directory") return <Folder size={14} className="text-amber-300" />;
  if (type === "file") return <FileText size={14} className="text-text-tertiary" />;
  if (type === "symlink") return <Link2 size={14} className="text-sky-300" />;
  return <File size={14} className="text-text-tertiary" />;
}

function typeLabel(type: FileEntryType | null): string {
  if (type === "directory") return "Directory";
  if (type === "file") return "File";
  if (type === "symlink") return "Symlink";
  return "—";
}

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

/** Normalize a user-typed path: absolute, no trailing slashes except root. */
export function normalizeTypedPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "/";
  let path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  path = path.replace(/\\+/g, "/").replace(/\/+/g, "/");
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}

export function FilesTab({ instanceName, project }: FilesTabProps) {
  const [cwd, setCwd] = useState("/");
  const [history, setHistory] = useState<string[]>(["/"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingPath, setEditingPath] = useState(false);
  const [pathDraft, setPathDraft] = useState("");
  const [pathError, setPathError] = useState<string | null>(null);
  const [entries, setEntries] = useState<string[] | null>(null);
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
  const pathBusyRef = useRef(false);

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

  const commitPath = useCallback(async () => {
    const path = normalizeTypedPath(pathDraft);
    if (path === cwd) {
      setEditingPath(false);
      setPathError(null);
      return;
    }
    pathBusyRef.current = true;
    setPathError(null);
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
      setEditingPath(false);
      setPathError(null);
    } catch {
      setPathError(`Path not found: ${path}`);
    } finally {
      pathBusyRef.current = false;
    }
  }, [pathDraft, cwd, navigateTo, instanceName, project]);

  const sweepStats = useCallback((dir: string, names: string[]) => {
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
        }
      })
      .catch(() => {
        setEntries([]);
        toast("danger", `Cannot list ${cwd}`);
      });
  }, [instanceName, cwd, project, sweepStats]);

  useEffect(refresh, [refresh]);

  const openEntry = async (name: string) => {
    const path = joinPath(cwd, name);
    if (stats[name]?.type === "directory") {
      navigateTo(path);
      return;
    }
    try {
      const result = await filesApi.read(instanceName, path, project);
      if (Array.isArray(result)) {
        navigateTo(path);
      } else {
        setEditPath(path);
        setEditContent(result);
      }
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
          <span data-testid={`entry-icon-${name}`} data-type={stats[name]?.type ?? "unknown"}>{entryIcon(stats[name]?.type ?? null)}</span>
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
      render: (name) => typeLabel(stats[name]?.type ?? null),
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

  const crumbs = cwd === "/" ? [] : cwd.split("/").slice(1);

  return (
    <div data-testid="files-tab">
      <div className="sticky top-0 z-10 bg-surface-900" data-testid="files-navbar">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <Button size="sm" variant="ghost" aria-label="Back" data-testid="files-back" disabled={historyIndex <= 0} onClick={goBack}><ArrowLeft size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label="Forward" data-testid="files-forward" disabled={historyIndex >= history.length - 1} onClick={goForward}><ArrowRight size={14} /></Button>
        <Button size="sm" variant="ghost" data-testid="files-up" disabled={cwd === "/"} onClick={() => navigateTo(parentOf(cwd))}><ArrowUp size={14} /></Button>

        {editingPath ? (
          <input
            autoFocus
            data-testid="files-path-input"
            aria-invalid={pathError !== null}
            value={pathDraft}
            onChange={(e) => {
              setPathDraft(e.target.value);
              if (pathError) setPathError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitPath();
              else if (e.key === "Escape") {
                setEditingPath(false);
                setPathError(null);
              }
            }}
            onBlur={() => {
              if (!pathBusyRef.current) {
                setEditingPath(false);
                setPathError(null);
              }
            }}
            placeholder="/path/to/directory"
            className={`min-w-0 flex-1 rounded border bg-surface-700 px-2 py-1.5 font-mono text-xs text-text-primary outline-none placeholder:text-text-tertiary ${pathError ? "border-danger focus:border-danger" : "border-accent-500"}`}
          />
        ) : (
          <div
            className="flex min-w-0 flex-1 cursor-text items-center gap-1 overflow-hidden rounded border border-border bg-surface-700 px-2 py-1.5 hover:border-surface-500"
            data-testid="files-breadcrumbs"
            title="Click to edit path"
            onClick={() => {
              setPathDraft(cwd);
              setEditingPath(true);
            }}
          >
            <button
              type="button"
              data-testid="crumb-root"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo("/");
              }}
              className="shrink-0 rounded px-1 font-mono text-xs text-text-secondary hover:bg-surface-600 hover:text-text-primary"
            >
              /
            </button>
            {crumbs.map((segment, i) => {
              const path = "/" + crumbs.slice(0, i + 1).join("/");
              return (
                <Fragment key={path}>
                  <ChevronRight size={12} className="shrink-0 text-text-tertiary" />
                  <button
                    type="button"
                    data-testid={
                      `crumb-${i}`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateTo(path);
                    }}
                    className={
                      `shrink-0 rounded px-1 font-mono text-xs ${i === crumbs.length - 1 ? "text-text-primary" : "text-text-secondary hover:bg-surface-600 hover:text-text-primary"}`
                    }
                  >
                    {segment}
                  </button>
                </Fragment>
              );
            })}
          </div>
        )}

        <Button size="sm" variant="ghost" data-testid="files-new-file" onClick={() => { setNewOpen(true); setNewName(""); setEditContent(""); setEditPath(""); }}><FilePlus2 size={14} /> New file</Button>
        <Button size="sm" variant="ghost" data-testid="files-new-dir" onClick={() => { setMkdirOpen(true); setMkdirName(""); }}><FolderPlus size={14} /> New folder</Button>
        <Button size="sm" variant="ghost" data-testid="files-upload" onClick={() => uploadRef.current?.click()}><Upload size={14} /> Upload</Button>
        <Button size="sm" variant="ghost" data-testid="files-refresh" onClick={refresh}><RefreshCw size={14} /></Button>
        <input ref={uploadRef} type="file" data-testid="files-upload-input" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
      </div>

      {pathError && (
        <div
          role="alert"
          data-testid="files-path-error"
          className="border-b border-danger/40 bg-danger/10 px-3 py-1.5 text-xs text-red-300"
        >
          {pathError}
        </div>
      )}
      </div>

      {sorted.length === 0 ? (
        <div className="px-3 pb-3">
          <EmptyState title="Empty directory" description="No files or folders here." />
        </div>
      ) : (
        <Table columns={columns} rows={sorted} rowKey={(e) => e} dataTestId="files-table" />
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
