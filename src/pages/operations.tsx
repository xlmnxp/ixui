import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { operationsApi } from "../api";
import { ApiError } from "../api/client";
import { operationsStore } from "../state/operations";
import { useStore } from "../state/store";
import type { Operation, OperationStatus } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Badge } from "../components/badge";
import type { BadgeTone } from "../components/badge";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

const statusTones: Record<OperationStatus, BadgeTone> = {
  Running: "info",
  Success: "success",
  Failure: "danger",
  Cancelled: "neutral",
  Unknown: "neutral",
};

export function OperationsPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const liveOperations = useStore(operationsStore);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Merge operations seen on the event stream (which the daemon prunes from the
  // REST list once finished) with the fetched list.
  const merged = useMemo(() => {
    const byId = new Map<string, Operation>();
    for (const op of operations) byId.set(op.id, op);
    for (const op of liveOperations) byId.set(op.id, op);
    return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [operations, liveOperations]);

  const refresh = useCallback(() => {
    void operationsApi
      .list()
      .then(setOperations)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const cancel = async (operation: Operation) => {
    try {
      await operationsApi.cancel(operation.id);
      toast("success", `Operation ${operation.description || operation.id} cancelled`);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Cancel failed");
    }
  };

  const columns: Column<Operation>[] = useMemo(
    () => [
      {
        key: "description",
        header: "Description",
        sortValue: (o) => o.description,
        render: (o) => <span className="font-medium">{o.description || o.id}</span>,
      },
      { key: "class", header: "Class", render: (o) => o.class },
      {
        key: "status",
        header: "Status",
        sortValue: (o) => o.status,
        render: (o) => (
          <Badge tone={statusTones[o.status] ?? "neutral"}>{o.status}</Badge>
        ),
      },
      { key: "created", header: "Created", sortValue: (o) => o.created_at, render: (o) => new Date(o.created_at).toLocaleString() },
      {
        key: "error",
        header: "Error",
        render: (o) =>
          o.status === "Failure" && o.err ? <span className="text-red-400" data-testid={`operation-error-${o.id}`}>{o.err}</span> : "—",
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (o) =>
          o.may_cancel ? (
            <Button size="sm" variant="ghost" data-testid={`operation-cancel-${o.id}`} onClick={() => void cancel(o)}>
              <X size={14} /> Cancel
            </Button>
          ) : null,
      },
    ],
    [cancel]
  );

  const barActions: ReactNode[] = [];

  useEffect(() => {
    registerBar?.({ title: "Operations", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="operations-page">
      {denied ? (
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view operations." />
        </div>
      ) : (
        <>
          {!registerBar && <PageBar title="Operations" actions={barActions} />}
          {loading ? (
            <Loading dataTestId="operations-loading" label="Loading operations…" />
          ) : merged.length === 0 ? (
            <EmptyState title="No operations" description="Operations appear here while they run; finished ones are pruned by the server." />
          ) : (
            <Table columns={columns} rows={merged} rowKey={(o) => o.id} stickyHeaderOffset={40} />
          )}
        </>
      )}
    </div>
  );
}
