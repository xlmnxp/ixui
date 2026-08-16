import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2 } from "lucide-react";
import { activityStore, clearActivity } from "../state/activity";
import type { ActivityEvent } from "../state/activity";
import { useStore } from "../state/store";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import type { BadgeTone } from "../components/badge";
import { Button } from "../components/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { EmptyState } from "../components/empty-state";
import { Input } from "../components/input";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";

const actionTones: Record<string, BadgeTone> = {
  "instance-deleted": "danger",
  "instance-created": "success",
  "instance-started": "info",
  "instance-stopped": "neutral",
};

export function ActivityPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const events = useStore(activityStore);
  const [filter, setFilter] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((e) =>
      [e.action, e.instance, e.project, e.username, e.address, e.source]
        .some((field) => field !== null && field.toLowerCase().includes(needle))
    );
  }, [events, filter]);

  const barActions: ReactNode[] = [
    <div key="filter" className="relative">
      <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
      <Input
        name="activity-filter"
        data-testid="activity-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by instance, action, user…"
        className="w-56 pl-7 text-xs"
      />
    </div>,
    <span key="count" className="text-xs text-text-tertiary" data-testid="activity-count">
      {filtered.length} of {events.length}
    </span>,
    <Button key="clear" size="sm" variant="ghost" data-testid="activity-clear" onClick={() => setClearOpen(true)}><Trash2 size={14} /> Clear</Button>,
  ];

  useEffect(() => {
    registerBar?.({ title: "Activity", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  const columns: Column<ActivityEvent>[] = [
    {
      key: "time",
      header: "Time",
      sortValue: (e) => e.receivedAt,
      render: (e) => <span className="whitespace-nowrap">{new Date(e.receivedAt).toLocaleString()}</span>,
    },
    {
      key: "action",
      header: "Action",
      sortValue: (e) => e.action,
      render: (e) => <Badge tone={actionTones[e.action] ?? "neutral"}>{e.action}</Badge>,
    },
    {
      key: "instance",
      header: "Instance",
      sortValue: (e) => e.instance ?? "",
      render: (e) =>
        e.instance ? (
          <Link
            to={`/instances/${e.instance}${e.project ? `?project=${encodeURIComponent(e.project)}` : ""}`}
            data-testid={`activity-instance-${e.id}`}
            className="font-mono text-xs text-accent-300 hover:underline"
          >
            {e.instance}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "project",
      header: "Project",
      sortValue: (e) => e.project ?? "",
      render: (e) => e.project ?? "—",
    },
    { key: "user", header: "User", sortValue: (e) => e.username ?? "", render: (e) => e.username ?? "—" },
    { key: "address", header: "Address", render: (e) => e.address ?? "—" },
  ];

  return (
    <div data-testid="activity-page">
      {!registerBar && <PageBar title="Activity" actions={barActions} />}

      {filtered.length === 0 ? (
        <EmptyState
          title="No activity recorded"
          description="Instance lifecycle events from the live event stream will appear here while the UI is open."
        />
      ) : (
        <Table columns={columns} rows={filtered} rowKey={(e) => e.id} stickyHeaderOffset={40} />
      )}

      <ConfirmDialog
        open={clearOpen}
        title="Clear activity"
        body="Remove all recorded activity events from this browser? This cannot be undone."
        confirmLabel="Clear"
        tone="danger"
        onConfirm={() => {
          clearActivity();
          setClearOpen(false);
        }}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );
}
