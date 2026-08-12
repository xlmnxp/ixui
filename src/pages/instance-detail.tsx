import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Camera, Check, FileText, Gauge, Play, RotateCw, Settings, Square, Terminal as TerminalIcon, Trash2, X } from "lucide-react";
import { instancesApi } from "../api";
import type { Instance } from "../api/types";
import { VerticalTabs } from "../components/vertical-tabs";
import { Button } from "../components/button";
import { PageBar } from "../components/page-bar";
import { ConfirmDialog } from "../components/confirm-dialog";
import { toast } from "../components/toast";
import { InstanceStatusIcon } from "../shell/instance-icon";
import { OverviewTab } from "./instance-overview";
import { SnapshotsTab } from "./instance/snapshots";
import { ConfigTab } from "./instance/config";
import type { ConfigActions } from "./instance/config";
import { LogsTab } from "./instance/logs";

export function InstanceDetailPage() {
  const { name = "", tab = "overview" } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [configActions, setConfigActions] = useState<ConfigActions | null>(null);

  const refresh = useCallback(() => {
    instancesApi.get(name).then(setInstance).catch(() => setNotFound(true));
  }, [name]);

  useEffect(refresh, [refresh]);

  const setState = async (action: "start" | "stop" | "restart") => {
    try {
      await instancesApi.setState(name, action);
      toast("info", `Requested ${action} for ${name}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : `${action} failed`);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await instancesApi.delete(name);
      toast("success", `Deleted ${name}`);
      navigate("/instances");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
      setDeleteOpen(false);
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
    { key: "logs", label: "Logs", icon: <FileText size={14} /> },
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "overview";

  return (
    <div className="flex h-full flex-col" data-testid="instance-detail-page">
      <PageBar
        dataTestId="instance-strip"
        title={
          <span className="flex items-center gap-2">
            {instance.name}
            <InstanceStatusIcon status={instance.status} />
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
          <Button key="start" size="sm" variant="ghost" data-testid="detail-action-start" disabled={instance.status === "Started" || instance.status === "Running"} onClick={() => setState("start")}><Play size={14} /> Start</Button>,
          <Button key="stop" size="sm" variant="ghost" data-testid="detail-action-stop" disabled={instance.status === "Stopped" || instance.status === "Error" || instance.status === "Stopping" || instance.status === "Freezing"} onClick={() => setState("stop")}><Square size={14} /> Stop</Button>,
          <Button key="restart" size="sm" variant="ghost" data-testid="detail-action-restart" disabled={instance.status !== "Started" && instance.status !== "Running"} onClick={() => setState("restart")}><RotateCw size={14} /> Restart</Button>,
          <Button key="delete" size="sm" variant="ghost" data-testid="detail-action-delete" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</Button>,
          <Button key="terminal" size="sm" variant="secondary" data-testid="detail-terminal" onClick={() => window.open(`/ui/terminal/${instance.name}`, `terminal-${instance.name}`, "width=1000,height=640")}><TerminalIcon size={14} /> Terminal</Button>,
        ]}
      />

      <div className="flex h-full min-h-0">
        <VerticalTabs tabs={tabs} active={activeTab} onChange={(key) => navigate(`/instances/${name}/${key}`)} />
        <div className="min-w-0 flex-1 overflow-auto">
          {activeTab === "overview" && <OverviewTab instance={instance} />}
          {activeTab === "snapshots" && <SnapshotsTab instanceName={name} />}
          {activeTab === "config" && <ConfigTab instanceName={name} registerActions={setConfigActions} />}
          {activeTab === "logs" && <LogsTab instanceName={name} />}
        </div>
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
    </div>
  );
}
