import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck } from "lucide-react";
import { warningsApi } from "../api";
import { ApiError } from "../api/client";
import type { Warning } from "../api/warnings";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import type { BadgeTone } from "../components/badge";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

const severityTones: Record<string, BadgeTone> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral",
};

export function WarningsPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(() => {
    void warningsApi
      .list()
      .then(setWarnings)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const ack = async (warning: Warning) => {
    try {
      await warningsApi.ack(warning.uuid);
      toast("success", "Warning acknowledged");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Ack failed");
    }
  };

  const columns: Column<Warning>[] = useMemo(
    () => [
      {
        key: "message",
        header: "Message",
        sortValue: (w) => w.message,
        render: (w) => <span className="font-medium">{w.message}</span>,
      },
      {
        key: "severity",
        header: "Severity",
        sortValue: (w) => w.severity,
        render: (w) => <Badge tone={severityTones[w.severity] ?? "neutral"}>{w.severity}</Badge>,
      },
      { key: "entity", header: "Entity", render: (w) => `${w.entity_type}: ${w.entity_id}` },
      { key: "first_seen", header: "First seen", sortValue: (w) => w.first_seen_at, render: (w) => new Date(w.first_seen_at).toLocaleString() },
      { key: "last_seen", header: "Last seen", sortValue: (w) => w.last_seen_at, render: (w) => new Date(w.last_seen_at).toLocaleString() },
      {
        key: "status",
        header: "Status",
        sortValue: (w) => w.status,
        render: (w) => (w.status === "Acknowledged" ? <Badge tone="success">{w.status}</Badge> : <Badge>{w.status}</Badge>),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (w) =>
          w.status !== "Acknowledged" ? (
            <Button size="sm" variant="ghost" data-testid={`warning-ack-${w.uuid}`} onClick={() => void ack(w)}>
              <CheckCheck size={14} /> Ack
            </Button>
          ) : null,
      },
    ],
    [ack]
  );

  useEffect(() => {
    registerBar?.({ title: "Warnings", actions: [] });
    return () => registerBar?.(null);
  }, [registerBar]);

  return (
    <div data-testid="warnings-page">
      {denied ? (
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view warnings." />
        </div>
      ) : (
        <>
          {!registerBar && <PageBar title="Warnings" />}
          {warnings.length === 0 ? (
            <EmptyState title="No warnings" />
          ) : (
            <Table columns={columns} rows={warnings} rowKey={(w) => w.uuid} stickyHeaderOffset={40} />
          )}
        </>
      )}
    </div>
  );
}
