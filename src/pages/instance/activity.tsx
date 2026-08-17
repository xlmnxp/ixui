import { useMemo } from "react";
import { activityStore } from "../../state/activity";
import type { ActivityEvent } from "../../state/activity";
import { useStore } from "../../state/store";
import { Table } from "../../components/table";
import type { Column } from "../../components/table";
import { Badge } from "../../components/badge";
import type { BadgeTone } from "../../components/badge";
import { EmptyState } from "../../components/empty-state";

const actionTones: Record<string, BadgeTone> = {
  "instance-deleted": "danger",
  "instance-created": "success",
  "instance-started": "info",
  "instance-stopped": "neutral",
};

export interface ActivityTabProps {
  instanceName: string;
  project?: string;
}

export function ActivityTab({ instanceName, project }: ActivityTabProps) {
  const events = useStore(activityStore);

  const rows = useMemo(
    () =>
      events.filter((e) => {
        if (e.instance !== instanceName) return false;
        if (project === undefined) return true;
        // The daemon omits ?project for the default project, so null means "default".
        const eventProject = e.project ?? "default";
        return eventProject === project;
      }),
    [events, instanceName, project]
  );

  const columns: Column<ActivityEvent>[] = [
    {
      key: "time",
      header: "Time",
      sortValue: (e) => e.receivedAt,
      render: (e) => new Date(e.receivedAt).toLocaleString(),
    },
    {
      key: "action",
      header: "Action",
      sortValue: (e) => e.action,
      render: (e) => <Badge tone={actionTones[e.action] ?? "neutral"}>{e.action}</Badge>,
    },
    { key: "user", header: "User", render: (e) => e.username ?? "—" },
    { key: "address", header: "Address", render: (e) => e.address ?? "—" },
  ];

  if (rows.length === 0) {
    return (
      <div data-testid="activity-tab">
        <EmptyState
          title="No activity recorded"
          description="Instance lifecycle events will appear here while the UI is open."
        />
      </div>
    );
  }

  return (
    <div data-testid="activity-tab">
      <Table columns={columns} rows={rows} rowKey={(e) => e.id} />
    </div>
  );
}
