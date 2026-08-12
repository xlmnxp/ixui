import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, Laptop, Pencil, Plus, Trash2, X } from "lucide-react";
import { infraApi, networkExtrasApi, serverApi } from "../api";
import type { Network } from "../api/types";
import type { Forward, Lease } from "../api/network-extras";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

export function NetworksPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Network | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Network | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("bridge");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);
  const [leasesNetwork, setLeasesNetwork] = useState<Network | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leasesBusy, setLeasesBusy] = useState(false);
  const [forwardsNetwork, setForwardsNetwork] = useState<Network | null>(null);
  const [forwards, setForwards] = useState<Forward[]>([]);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardAddress, setForwardAddress] = useState("");
  const [forwardDescription, setForwardDescription] = useState("");
  const [forwardDeleteTarget, setForwardDeleteTarget] = useState<Forward | null>(null);
  const [forwardBusy, setForwardBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listNetworks().then(setNetworks).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    void serverApi.metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        for (const c of m.configs ?? []) if (c.key) map[c.key] = c.description;
        setDescriptions(map);
      })
      .catch(() => {});
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createNetwork({ name: name.trim(), type, description: description.trim() });
      toast("success", `Network ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (network: Network) => {
    setEditing(network);
    setDescription(network.description);
    setConfig({});
    setConfigLoading(true);
    try {
      const n = await infraApi.getNetwork(network.name);
      setConfig(n.config ?? {});
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    } finally {
      setConfigLoading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await infraApi.updateNetworkConfig(editing.name, { description, config });
      toast("success", `Network ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
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
      await Promise.all(selectedKeys.map((name) => infraApi.deleteNetwork(name)));
      toast("success", `Deleted ${selectedKeys.length} network(s)`);
      setSelectedKeys([]);
      setDeleteManyOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeletingMany(false);
    }
  };

  const openLeases = async (network: Network) => {
    setLeasesNetwork(network);
    setLeases([]);
    setLeasesBusy(true);
    try {
      setLeases(await networkExtrasApi.listLeases(network.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    } finally {
      setLeasesBusy(false);
    }
  };

  const openForwards = async (network: Network) => {
    setForwardsNetwork(network);
    setForwards([]);
    try {
      setForwards(await networkExtrasApi.listForwards(network.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    }
  };

  const addForward = async () => {
    if (!forwardsNetwork) return;
    setForwardBusy(true);
    try {
      await networkExtrasApi.createForward(forwardsNetwork.name, { listen_address: forwardAddress.trim(), description: forwardDescription.trim() });
      toast("success", `Forward ${forwardAddress} created`);
      setForwardOpen(false);
      setForwardAddress("");
      setForwardDescription("");
      setForwards(await networkExtrasApi.listForwards(forwardsNetwork.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setForwardBusy(false);
    }
  };

  const removeForward = async () => {
    if (!forwardsNetwork || !forwardDeleteTarget) return;
    try {
      await networkExtrasApi.deleteForward(forwardsNetwork.name, forwardDeleteTarget.listen_address);
      toast("success", `Forward ${forwardDeleteTarget.listen_address} deleted`);
      setForwardDeleteTarget(null);
      setForwards(await networkExtrasApi.listForwards(forwardsNetwork.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Network>[] = [
    { key: "name", header: "Name", sortValue: (n) => n.name, render: (n) => <span className="font-medium">{n.name}</span> },
    { key: "type", header: "Type", render: (n) => n.type },
    { key: "managed", header: "Managed", render: (n) => (n.managed ? "Yes" : "No") },
    { key: "used", header: "Used by", render: (n) => n.used_by.length },
    { key: "status", header: "Status", render: (n) => n.status },
    {
      key: "actions", header: "", align: "right",
      render: (n) => (
        <div className="flex justify-end gap-1">
          {n.managed && (
            <>
              <Button size="sm" variant="ghost" data-testid={`network-leases-${n.name}`} onClick={() => openLeases(n)}><Laptop size={14} /> Leases</Button>
              <Button size="sm" variant="ghost" data-testid={`network-forwards-${n.name}`} onClick={() => openForwards(n)}><ArrowLeftRight size={14} /> Forwards</Button>
            </>
          )}
          <Button size="sm" variant="ghost" data-testid={`network-edit-${n.name}`} onClick={() => openEdit(n)}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`network-delete-${n.name}`} onClick={() => setDeleteTarget(n)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const leaseColumns: Column<Lease>[] = [
    { key: "address", header: "Address", render: (l) => <span className="font-mono">{l.address}</span> },
    { key: "hostname", header: "Hostname", render: (l) => l.hostname || "—" },
    { key: "hwaddr", header: "MAC", render: (l) => <span className="font-mono">{l.hwaddr}</span> },
    { key: "type", header: "Type", render: (l) => l.type },
    { key: "expires", header: "Expires", render: (l) => l.expires_at },
  ];

  const forwardColumns: Column<Forward>[] = [
    { key: "listen_address", header: "Listen address", render: (f) => <span className="font-mono">{f.listen_address}</span> },
    { key: "description", header: "Description", render: (f) => f.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (f) => (
        <Button size="sm" variant="ghost" data-testid={`network-forward-delete-${f.listen_address}`} onClick={() => setForwardDeleteTarget(f)}><Trash2 size={14} /> Delete</Button>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}><Trash2 size={14} /> Delete</Button>,
      <Button key="create" size="sm" data-testid="network-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create network</Button>,
    ],
    [selectedKeys, setDeleteManyOpen, setCreateOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Networks", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div className="space-y-4" data-testid="networks-page">
      {!registerBar && <PageBar title="Networks" actions={barActions} />}

      {networks.length === 0 ? (
        <EmptyState title="No networks" />
      ) : (
        <Table columns={columns} rows={networks} rowKey={(n) => n.name} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create network" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="network-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="network-name" data-testid="network-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Select label="Type" name="network-type" data-testid="network-type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bridge">bridge</option>
            <option value="ovn">ovn</option>
            <option value="physical">physical</option>
            <option value="macvlan">macvlan</option>
          </Select>
          <Input label="Description" name="network-desc" data-testid="network-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit network ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="network-save"><Check size={14} /> Save</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Description" name="network-edit-desc" data-testid="network-edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Config</h3>
            {configLoading ? (
              <div className="py-4 text-center text-sm text-text-tertiary">Loading config…</div>
            ) : (
              <KeyValueEditor values={config} onChange={setConfig} dataTestId="network-config-editor" descriptions={descriptions} />
            )}
          </div>
        </div>
      </Dialog>

      <Dialog open={leasesNetwork !== null} onClose={() => setLeasesNetwork(null)} title={`Leases for ${leasesNetwork?.name ?? ""}`} footer={
        <Button variant="secondary" onClick={() => setLeasesNetwork(null)}><X size={14} /> Close</Button>
      }>
        {leasesBusy ? (
          <div className="py-4 text-center text-sm text-text-tertiary">Loading leases…</div>
        ) : (
          <Table columns={leaseColumns} rows={leases} rowKey={(l) => l.address} dataTestId="network-leases-table" emptyMessage="No leases" />
        )}
      </Dialog>

      <Dialog open={forwardsNetwork !== null} onClose={() => setForwardsNetwork(null)} title={`Forwards for ${forwardsNetwork?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setForwardsNetwork(null)}><X size={14} /> Close</Button>
          <Button data-testid="network-forward-open" onClick={() => setForwardOpen(true)}><Plus size={14} /> Add forward</Button>
        </>
      }>
        <Table columns={forwardColumns} rows={forwards} rowKey={(f) => f.listen_address} dataTestId="network-forwards-table" emptyMessage="No forwards" />
      </Dialog>

      <Dialog open={forwardOpen} onClose={() => setForwardOpen(false)} title={`Add forward to ${forwardsNetwork?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setForwardOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={addForward} loading={forwardBusy} data-testid="network-forward-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Listen address" name="forward-address" data-testid="forward-address" value={forwardAddress} onChange={(e) => setForwardAddress(e.target.value)} />
          <Input label="Description" name="forward-description" data-testid="forward-description" value={forwardDescription} onChange={(e) => setForwardDescription(e.target.value)} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete network"
        body={`Delete network ${deleteTarget?.name}?`}
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
      <ConfirmDialog
        open={forwardDeleteTarget !== null}
        title="Delete forward"
        body={`Delete forward ${forwardDeleteTarget?.listen_address}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removeForward}
        onCancel={() => setForwardDeleteTarget(null)}
      />
    </div>
  );
}
