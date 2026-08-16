import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Camera, Check, Copy as CopyIcon, Cpu, Download, FileText, FolderOpen, Gauge, History, Monitor, MoreHorizontal, Plus, MoveRight, Pencil, Play, RotateCw, Settings, Square, Terminal as TerminalIcon, Trash2, X } from "lucide-react";
import { backupsApi, instancesApi, operationsApi } from "../api";
import type { Instance } from "../api/types";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { ALL_PROJECTS, registerInstanceProject } from "../api/client";
import { VerticalTabs } from "../components/vertical-tabs";
import { SplitPane } from "../components/split-pane";
import { Button } from "../components/button";
import { PageBar } from "../components/page-bar";
import { ConfirmDialog } from "../components/confirm-dialog";
import { RenameInstanceDialog, CopyInstanceDialog, MoveInstanceDialog } from "../components/instance-dialogs";
import { toast } from "../components/toast";
import { InstanceIcon } from "../shell/instance-icon";
import { OverviewTab } from "./instance-overview";
import { SnapshotsTab } from "./instance/snapshots";
import type { SnapshotsActions } from "./instance/snapshots";
import { DevicesTab } from "./instance/devices";
import type { DeviceActions } from "./instance/devices";
import { ConfigTab } from "./instance/config";
import type { ConfigActions } from "./instance/config";
import { LogsTab } from "./instance/logs";
import { ActivityTab } from "./instance/activity";
import { FilesTab } from "./instance/files";

export function InstanceDetailPage() {
  const { name = "", tab = "overview" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentProject = useStore(currentProjectStore);
  const allInstances = useStore(instancesStore);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [configActions, setConfigActions] = useState<ConfigActions | null>(null);
  const [deviceActions, setDeviceActions] = useState<DeviceActions | null>(null);
  const [snapshotsActions, setSnapshotsActions] = useState<SnapshotsActions | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const explicitProject = searchParams.get("project") ?? undefined;
  const storeProject = Object.values(allInstances).find((i) => i.name === name)?.project;
  const apiProject = explicitProject ?? (currentProject === ALL_PROJECTS ? storeProject : currentProject);

  useEffect(() => {
    if (apiProject) registerInstanceProject(name, apiProject);
  }, [apiProject, name]);

  const refresh = useCallback(() => {
    setNotFound(false);
    instancesApi.get(name, apiProject).then(setInstance).catch(() => {
      if (apiProject !== undefined) setNotFound(true);
    });
  }, [name, apiProject]);

  useEffect(refresh, [refresh]);

  const storeInstance = Object.values(allInstances).find((i) => i.name === name);
  useEffect(() => {
    if (storeInstance) setInstance(storeInstance);
  }, [storeInstance, name]);

  // Load the VM display screenshot for the action-bar thumbnail.
  useEffect(() => {
    if (!instance || instance.type !== "virtual-machine") return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(instancesApi.screenshotUrl(instance.name, instance.project), { credentials: "include" });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setScreenshotUrl(objectUrl);
      } catch {
        // Leave the icon-only fallback.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [instance]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const setState = async (action: "start" | "stop" | "restart") => {
    try {
      await instancesApi.setState(name, action, false, instance?.project);
      toast("info", `Requested ${action} for ${name}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await instancesApi.delete(name, instance?.project);
      toast("success", `Deleted ${name}`);
      navigate("/instances");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const exportBackup = async () => {
    setMoreOpen(false);
    setExporting(true);
    try {
      const backupName = `export-${Date.now()}`;
      const result = await backupsApi.create(name, backupName, undefined, instance?.project);
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Export failed");
      }
      const res = await fetch(backupsApi.exportUrl(name, backupName, instance?.project), { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${name}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast("success", `Export of ${name} downloaded`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (notFound) {
    return (
      <div className="p-6" data-testid="instance-not-found">
        <h1 className="text-lg font-semibold text-text-primary">Instance not found</h1>
      </div>
    );
  }
  if (!instance) return <div className="p-6" data-testid="instance-loading">Loading…</div>;

  const tabs = [
    { key: "overview", label: "Overview", icon: <Gauge size={14} /> },
    { key: "snapshots", label: "Snapshots", icon: <Camera size={14} /> },
    { key: "config", label: "Config", icon: <Settings size={14} /> },
    { key: "devices", label: "Devices", icon: <Cpu size={14} /> },
    { key: "logs", label: "Logs", icon: <FileText size={14} /> },
    { key: "files", label: "Files", icon: <FolderOpen size={14} /> },
    { key: "activity", label: "Activity", icon: <History size={14} /> },
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview";

  return (
    <div className="flex h-full flex-col" data-testid="instance-detail-page">
      <PageBar
        dataTestId="instance-strip"
        title={
          <span className="flex items-center gap-2">
            <InstanceIcon status={instance.status} type={instance.type} />
            {instance.name}
          </span>
        }
        actions={[
          ...(activeTab === "config" && configActions
            ? [
                <Button key="save" size="sm" variant="secondary" data-testid="config-save" disabled={!configActions.dirty} onClick={() => void configActions.save()}><Check size={14} /> Save</Button>,
                <Button key="cancel" size="sm" variant="ghost" data-testid="config-cancel" onClick={configActions.cancel}><X size={14} /> Cancel</Button>,
                <Button key="config-delete" size="sm" variant="ghost" data-testid="config-delete" disabled={configActions.selectedCount === 0} onClick={configActions.removeSelected}><Trash2 size={14} /> Delete</Button>,
                <span key="divider" className="mx-1 h-5 w-px bg-border" />,
              ]
            : []),
          ...(activeTab === "snapshots" && snapshotsActions
            ? [
                <Button key="snap-create" size="sm" variant="secondary" data-testid="snap-create-open" onClick={snapshotsActions.create}><Plus size={14} /> Create snapshot</Button>,
                <span key="divider" className="mx-1 h-5 w-px bg-border" />,
              ]
            : []),
          ...(activeTab === "devices" && deviceActions
            ? [
                <Button key="device-add" size="sm" variant="secondary" data-testid="device-add" onClick={deviceActions.add}><Plus size={14} /> Add device</Button>,
                <span key="divider" className="mx-1 h-5 w-px bg-border" />,
              ]
            : []),
          <Button key="start" size="sm" variant="ghost" data-testid="detail-action-start" disabled={instance.status === "Started" || instance.status === "Running"} onClick={() => setState("start")}><Play size={14} /> Start</Button>,
          <Button key="stop" size="sm" variant="ghost" data-testid="detail-action-stop" disabled={instance.status === "Stopped" || instance.status === "Error" || instance.status === "Stopping" || instance.status === "Freezing"} onClick={() => setState("stop")}><Square size={14} /> Stop</Button>,
          <Button key="restart" size="sm" variant="ghost" data-testid="detail-action-restart" disabled={instance.status !== "Started" && instance.status !== "Running"} onClick={() => setState("restart")}><RotateCw size={14} /> Restart</Button>,
          <div key="more" ref={moreRef} className="relative">
            <Button size="sm" variant="ghost" data-testid="detail-more" onClick={() => setMoreOpen((o) => !o)}><MoreHorizontal size={14} /> More</Button>
            {moreOpen && (
              <div data-testid="detail-more-menu" className="absolute right-0 top-full z-40 mt-1 w-40 overflow-hidden rounded border border-border bg-surface-800 py-1 shadow-xl">
                <button type="button" data-testid="detail-more-rename" onClick={() => { setMoreOpen(false); setRenameOpen(true); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-surface-700"><Pencil size={14} /> Rename</button>
                <button type="button" data-testid="detail-more-copy" onClick={() => { setMoreOpen(false); setCopyOpen(true); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-surface-700"><CopyIcon size={14} /> Copy</button>
                <button type="button" data-testid="detail-more-move" onClick={() => { setMoreOpen(false); setMoveOpen(true); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-surface-700"><MoveRight size={14} /> Move</button>
                <button type="button" data-testid="detail-more-export" disabled={exporting} onClick={() => void exportBackup()} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-text-primary hover:bg-surface-700"><Download size={14} /> Export</button>
              </div>
            )}
          </div>,
          <Button key="delete" size="sm" variant="ghost" data-testid="detail-action-delete" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</Button>,
          ...(instance.type === "virtual-machine"
            ? [
                <Button
                  key="screenshot"
                  size="sm"
                  variant="ghost"
                  className="!px-0 !py-0"
                  title="Open console"
                  aria-label="Open console"
                  data-testid="detail-screenshot"
                  onClick={() =>
                    window.open(
                      `/ui/terminal/${instance.name}?project=${encodeURIComponent(instance.project)}&mode=vga`,
                      `terminal-${instance.name}`,
                      "width=1000,height=640"
                    )
                  }
                >
                  {screenshotUrl ? (
                    <img src={screenshotUrl} alt="" data-testid="detail-screenshot-img" className="h-5 w-auto max-w-12 object-contain" />
                  ) : (
                    <Monitor size={14} />
                  )}
                </Button>,
              ]
            : []),
          <Button key="terminal" size="sm" variant="secondary" data-testid="detail-terminal" onClick={() => window.open(`/ui/terminal/${instance.name}?project=${instance.project}`, `terminal-${instance.name}`, "width=1000,height=640")}><TerminalIcon size={14} /> Terminal</Button>,
        ]}
      />

      <div className="min-h-0 flex-1">
        <SplitPane
          initial={20}
          min={12}
          left={<VerticalTabs tabs={tabs} active={activeTab} onChange={(key) => navigate(`/instances/${name}/${key}`)} />}
          right={
            <div className="h-full overflow-auto">
              {activeTab === "overview" && <OverviewTab instance={instance} />}
              {activeTab === "snapshots" && <SnapshotsTab instanceName={name} project={instance.project} registerActions={setSnapshotsActions} />}
              {activeTab === "config" && <ConfigTab instanceName={name} project={instance.project} registerActions={setConfigActions} />}
              {activeTab === "devices" && <DevicesTab instanceName={name} project={instance.project} registerActions={setDeviceActions} />}
              {activeTab === "logs" && <LogsTab instanceName={name} project={instance.project} />}
              {activeTab === "files" && <FilesTab instanceName={name} project={instance.project} />}
              {activeTab === "activity" && <ActivityTab instanceName={name} project={instance.project} />}
            </div>
          }
        />
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${name}`}
        body="This will permanently delete the instance. This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      <RenameInstanceDialog open={renameOpen} onClose={() => setRenameOpen(false)} name={name} project={instance.project} onRenamed={(newName) => navigate(`/instances/${newName}`)} />
      <CopyInstanceDialog open={copyOpen} onClose={() => setCopyOpen(false)} name={name} project={instance.project} defaultPool={instance.devices.root?.pool} />
      <MoveInstanceDialog
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        name={name}
        sourceProject={instance.project}
        onMoved={(project) => {
          void loadInstances(currentProjectStore.getState()).catch(() => {});
          if (project && project !== instance.project) navigate("/instances");
          else refresh();
        }}
      />
    </div>
  );
}
