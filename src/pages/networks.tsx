import { useCallback, useEffect, useMemo, useState } from "react";
import { Network as NetworkIcon, Plus, Settings2, Trash2 } from "lucide-react";
import { infraApi } from "../api";
import type { Network } from "../api/types";
import { NetworkManageWindow } from "../components/network-manage";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { ReviewList, StepDialog } from "../components/step-dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

/** Configured address for a family, or undefined when the network has none. */
function prefixOf(network: Network, family: "ipv4" | "ipv6"): string | undefined {
  const value = network.config?.[`${family}.address`];
  if (!value || value === "none" || value === "auto") return undefined;
  return value;
}

export function NetworksPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [managing, setManaging] = useState<Network | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("bridge");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    void infraApi
      .listNetworks()
      .then(setNetworks)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const openCreate = useCallback(() => {
    setName("");
    setType("bridge");
    setDescription("");
    setConfig({});
    setCreateOpen(true);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createNetwork({ name: name.trim(), type, description: description.trim(), config });
      toast("success", `Network ${name.trim()} created`);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteNetwork(deleteTarget.name);
      toast("success", `Network ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const removeMany = async () => {
    setDeletingMany(true);
    try {
      await Promise.all(selectedKeys.map((key) => infraApi.deleteNetwork(key)));
      toast("success", `Deleted ${selectedKeys.length} network(s)`);
      setSelectedKeys([]);
      setDeleteManyOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeletingMany(false);
    }
  };

  const columns: Column<Network>[] = [
    { key: "name", header: "Name", sortValue: (n) => n.name, render: (n) => <span className="font-medium">{n.name}</span> },
    { key: "type", header: "Type", sortValue: (n) => n.type, render: (n) => n.type },
    {
      key: "ipv4",
      header: "IPv4 prefix",
      render: (n) => {
        const value = prefixOf(n, "ipv4");
        return value ? <span className="font-mono text-xs">{value}</span> : <span className="text-text-tertiary">—</span>;
      },
    },
    {
      key: "ipv6",
      header: "IPv6 prefix",
      render: (n) => {
        const value = prefixOf(n, "ipv6");
        return value ? <span className="font-mono text-xs">{value}</span> : <span className="text-text-tertiary">—</span>;
      },
    },
    { key: "managed", header: "Managed", render: (n) => (n.managed ? "Yes" : "No") },
    { key: "used", header: "Used by", render: (n) => n.used_by.length },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`network-manage-${n.name}`} onClick={() => setManaging(n)}>
            <Settings2 size={14} /> Manage
          </Button>
          <Button size="sm" variant="ghost" data-testid={`network-delete-${n.name}`} onClick={() => setDeleteTarget(n)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}>
        <Trash2 size={14} /> Delete
      </Button>,
      <Button key="create" size="sm" data-testid="network-create-open" onClick={openCreate}>
        <Plus size={14} /> Create network
      </Button>,
    ],
    [selectedKeys, openCreate]
  );

  useEffect(() => {
    registerBar?.({ title: "Networks", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="networks-page">
      {!registerBar && <PageBar title="Networks" actions={barActions} />}

      {loading ? (
        <Loading dataTestId="networks-loading" label="Loading networks…" />
      ) : networks.length === 0 ? (
        <EmptyState title="No networks" description="Create a bridge or OVN network to connect instances." />
      ) : (
        <Table
          persistKey="networks"
          columns={columns}
          rows={networks}
          rowKey={(n) => n.name}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
        />
      )}

      <StepDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create network"
        submitLabel="Create"
        submitIcon={<Plus size={14} />}
        busy={busy}
        windowMode
        windowIcon={<NetworkIcon size={15} />}
        windowWidth={900}
        onSubmit={create}
        steps={[
          {
            key: "basics",
            title: "Basics",
            invalid: name.trim() ? null : "Enter a network name",
            content: (
              <div className="space-y-3">
                <Input label="Name" name="network-name" placeholder="br0" data-testid="network-name" value={name} onChange={(e) => setName(e.target.value)} />
                <Select label="Type" name="network-type" data-testid="network-type" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="bridge">bridge</option>
                  <option value="ovn">ovn</option>
                  <option value="physical">physical</option>
                  <option value="macvlan">macvlan</option>
                </Select>
                <Input label="Description" name="network-desc" placeholder="Optional" data-testid="network-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            ),
          },
          {
            key: "config",
            title: "Configuration",
            content: (
              <div className="space-y-2">
                <p className="text-xs text-text-tertiary">
                  Optional. Leave empty for defaults{type === "bridge" ? " (Incus picks an IPv4/IPv6 subnet automatically)" : ""}.
                </p>
                <KeyValueEditor values={config} onChange={setConfig} dataTestId="network-config-editor" stickyHeader />
              </div>
            ),
          },
          {
            key: "review",
            title: "Review",
            content: (
              <ReviewList
                rows={[
                  { label: "Name", value: name || "—" },
                  { label: "Type", value: type },
                  { label: "Description", value: description || "—" },
                  { label: "Config keys", value: Object.keys(config).length === 0 ? "Defaults" : Object.entries(config).map(([k, v]) => `${k}=${v}`).join(", ") },
                ]}
              />
            ),
          },
        ]}
      />

      <NetworkManageWindow network={managing} onClose={() => setManaging(null)} onChanged={refresh} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete network"
        body={`Delete network ${deleteTarget?.name ?? ""}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={deleteManyOpen}
        title="Delete networks"
        body={`Delete ${selectedKeys.length} selected network(s)?`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletingMany}
        onConfirm={removeMany}
        onCancel={() => setDeleteManyOpen(false)}
      />
    </div>
  );
}