import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { instancesApi } from "../api";
import type { Instance } from "../api/types";
import { Tabs } from "../components/tabs";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { toast } from "../components/toast";
import { instanceStatusTone } from "../lib/instance-status";
import { OverviewTab } from "./instance-overview";
import { ConsoleTab } from "./instance/console";
import { SnapshotsTab } from "./instance/snapshots";
import { ConfigTab } from "./instance/config";
import { LogsTab } from "./instance/logs";

export function InstanceDetailPage() {
  const { name = "", tab = "overview" } = useParams();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    { key: "overview", label: "Overview" },
    { key: "console", label: "Console" },
    { key: "snapshots", label: "Snapshots" },
    { key: "config", label: "Config" },
    { key: "logs", label: "Logs" },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="instance-detail-page">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text-primary">{instance.name}</h1>
        <Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" data-testid="detail-action-start" disabled={instance.status === "Started" || instance.status === "Running"} onClick={() => setState("start")}>Start</Button>
          <Button size="sm" variant="secondary" data-testid="detail-action-stop" disabled={instance.status === "Stopped" || instance.status === "Error" || instance.status === "Stopping" || instance.status === "Freezing"} onClick={() => setState("stop")}>Stop</Button>
          <Button size="sm" variant="secondary" data-testid="detail-action-restart" disabled={instance.status !== "Started" && instance.status !== "Running"} onClick={() => setState("restart")}>Restart</Button>
          <Button size="sm" variant="danger" data-testid="detail-action-delete" onClick={() => setDeleteOpen(true)}>Delete</Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={(key) => navigate(`/instances/${name}/${key}`)} />

      {tab === "overview" && <OverviewTab instance={instance} />}
      {tab === "console" && <ConsoleTab instanceName={name} />}
      {tab === "snapshots" && <SnapshotsTab instanceName={name} />}
      {tab === "config" && <ConfigTab instanceName={name} />}
      {tab === "logs" && <LogsTab instanceName={name} />}

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
