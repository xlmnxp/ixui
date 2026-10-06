import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { networkExtrasApi } from "../api";
import type { LoadBalancer, NetworkPeer } from "../api/network-extras";
import type { Network } from "../api/types";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { Input } from "./input";
import { Loading } from "./loading";
import { Select } from "./select";
import { Table } from "./table";
import type { Column } from "./table";
import { Tabs } from "./tabs";
import { toast } from "./toast";

type Tab = "lbs" | "peers";

interface BackendRow {
  name: string;
  address: string;
  port: string;
}

interface PortRow {
  protocol: "tcp" | "udp";
  listenPort: string;
  backends: string;
}

const splitNames = (text: string): string[] =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Builds the API body, or returns a message describing what's wrong with the form. */
export function buildLoadBalancer(
  listenAddress: string,
  description: string,
  backends: BackendRow[],
  ports: PortRow[],
): LoadBalancer | string {
  if (!listenAddress.trim()) return "Listen address is required";
  const filledBackends = backends.filter((b) => b.name.trim() || b.address.trim());
  for (const b of filledBackends) if (!b.name.trim() || !b.address.trim()) return "Each backend needs a name and a target address";
  const names = new Set(filledBackends.map((b) => b.name.trim()));
  const filledPorts = ports.filter((p) => p.listenPort.trim() || p.backends.trim());
  for (const p of filledPorts) {
    if (!p.listenPort.trim()) return "Each port rule needs a listen port";
    const targets = splitNames(p.backends);
    if (targets.length === 0) return "Each port rule needs at least one target backend";
    const unknown = targets.find((t) => !names.has(t));
    if (unknown) return `Port rule targets unknown backend "${unknown}"`;
  }
  return {
    listen_address: listenAddress.trim(),
    description: description.trim(),
    backends: filledBackends.map((b) => ({
      name: b.name.trim(),
      target_address: b.address.trim(),
      ...(b.port.trim() ? { target_port: b.port.trim() } : {}),
    })),
    ports: filledPorts.map((p) => ({ protocol: p.protocol, listen_port: p.listenPort.trim(), target_backend: splitNames(p.backends) })),
  };
}

export interface NetworkLinksDialogProps {
  network: Network | null;
  onClose: () => void;
}

export function NetworkLinksDialog({ network, onClose }: NetworkLinksDialogProps) {
  const [tab, setTab] = useState<Tab>("lbs");
  const [lbs, setLbs] = useState<LoadBalancer[]>([]);
  const [peers, setPeers] = useState<NetworkPeer[]>([]);
  const [loading, setLoading] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [peerOpen, setPeerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lbDelete, setLbDelete] = useState<LoadBalancer | null>(null);
  const [peerDelete, setPeerDelete] = useState<NetworkPeer | null>(null);

  const [listen, setListen] = useState("");
  const [lbDesc, setLbDesc] = useState("");
  const [backends, setBackends] = useState<BackendRow[]>([{ name: "", address: "", port: "" }]);
  const [ports, setPorts] = useState<PortRow[]>([{ protocol: "tcp", listenPort: "", backends: "" }]);

  const [peerName, setPeerName] = useState("");
  const [peerProject, setPeerProject] = useState("default");
  const [peerNetwork, setPeerNetwork] = useState("");

  const isOvn = network?.type === "ovn";
  const name = network?.name ?? "";

  const refresh = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    try {
      const [l, p] = await Promise.all([
        networkExtrasApi.listLoadBalancers(name).catch(() => []),
        isOvn ? networkExtrasApi.listPeers(name).catch(() => []) : Promise.resolve([]),
      ]);
      setLbs(l);
      setPeers(p);
    } finally {
      setLoading(false);
    }
  }, [name, isOvn]);

  useEffect(() => {
    if (network) {
      setTab("lbs");
      void refresh();
    }
  }, [network, refresh]);

  const openLb = () => {
    setListen("");
    setLbDesc("");
    setBackends([{ name: "", address: "", port: "" }]);
    setPorts([{ protocol: "tcp", listenPort: "", backends: "" }]);
    setLbOpen(true);
  };

  const createLb = async () => {
    const body = buildLoadBalancer(listen, lbDesc, backends, ports);
    if (typeof body === "string") {
      toast("danger", body);
      return;
    }
    setBusy(true);
    try {
      await networkExtrasApi.createLoadBalancer(name, body);
      toast("success", `Load balancer ${body.listen_address} created`);
      setLbOpen(false);
      void refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const removeLb = async () => {
    if (!lbDelete) return;
    try {
      await networkExtrasApi.deleteLoadBalancer(name, lbDelete.listen_address);
      toast("success", `Deleted load balancer ${lbDelete.listen_address}`);
      setLbDelete(null);
      void refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const createPeer = async () => {
    if (!peerName.trim() || !peerProject.trim() || !peerNetwork.trim()) {
      toast("danger", "Name, target project and target network are required");
      return;
    }
    setBusy(true);
    try {
      await networkExtrasApi.createPeer(name, { name: peerName.trim(), target_project: peerProject.trim(), target_network: peerNetwork.trim() });
      toast("success", `Peer ${peerName.trim()} created`);
      setPeerOpen(false);
      setPeerName("");
      setPeerNetwork("");
      void refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const removePeer = async () => {
    if (!peerDelete) return;
    try {
      await networkExtrasApi.deletePeer(name, peerDelete.name);
      toast("success", `Deleted peer ${peerDelete.name}`);
      setPeerDelete(null);
      void refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const lbColumns: Column<LoadBalancer>[] = [
    { key: "listen", header: "Listen address", render: (l) => <span className="font-mono">{l.listen_address}</span> },
    { key: "backends", header: "Backends", render: (l) => l.backends?.length ?? 0 },
    {
      key: "ports", header: "Ports",
      render: (l) => <span className="text-xs">{l.ports?.length ? l.ports.map((p) => `${p.protocol}/${p.listen_port}`).join(", ") : "—"}</span>,
    },
    {
      key: "actions", header: "", align: "right",
      render: (l) => <Button size="sm" variant="ghost" data-testid={`lb-delete-${l.listen_address}`} onClick={() => setLbDelete(l)}><Trash2 size={14} /> Delete</Button>,
    },
  ];

  const peerColumns: Column<NetworkPeer>[] = [
    { key: "name", header: "Name", render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "target", header: "Target", render: (p) => (p.target_network ? `${p.target_project ?? "default"}/${p.target_network}` : "—") },
    { key: "status", header: "Status", render: (p) => p.status || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (p) => <Button size="sm" variant="ghost" data-testid={`peer-delete-${p.name}`} onClick={() => setPeerDelete(p)}><Trash2 size={14} /> Delete</Button>,
    },
  ];

  const tabs = [{ key: "lbs", label: "Load balancers" }, ...(isOvn ? [{ key: "peers", label: "Peers" }] : [])];

  return (
    <>
      <Dialog
        open={network !== null}
        onClose={onClose}
        wide
        title={`Load balancers & peers for ${name}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}><X size={14} /> Close</Button>
            {tab === "lbs" ? (
              <Button data-testid="lb-open" onClick={openLb}><Plus size={14} /> Add load balancer</Button>
            ) : (
              <Button data-testid="peer-open" onClick={() => setPeerOpen(true)}><Plus size={14} /> Add peer</Button>
            )}
          </>
        }
      >
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />
        {loading ? (
          <Loading dataTestId="network-links-loading" label="Loading…" />
        ) : tab === "lbs" ? (
          <Table columns={lbColumns} rows={lbs} rowKey={(l) => l.listen_address} dataTestId="lb-table" emptyMessage="No load balancers" />
        ) : (
          <Table columns={peerColumns} rows={peers} rowKey={(p) => p.name} dataTestId="peer-table" emptyMessage="No peers" />
        )}
      </Dialog>

      <Dialog
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        title={`Add load balancer to ${name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLbOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={createLb} loading={busy} data-testid="lb-create-submit"><Plus size={14} /> Create</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Listen address" name="lb-listen" data-testid="lb-listen" value={listen} onChange={(e) => setListen(e.target.value)} />
          <Input label="Description" name="lb-desc" value={lbDesc} onChange={(e) => setLbDesc(e.target.value)} />
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Backends</h3>
            {backends.map((b, i) => (
              <div key={i} className="mb-1 grid grid-cols-[1fr_1.4fr_5rem_auto] gap-1">
                <Input aria-label={`Backend ${i + 1} name`} placeholder="name" data-testid={`lb-backend-name-${i}`} value={b.name} onChange={(e) => setBackends((r) => r.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label={`Backend ${i + 1} address`} placeholder="target address" data-testid={`lb-backend-address-${i}`} value={b.address} onChange={(e) => setBackends((r) => r.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} />
                <Input aria-label={`Backend ${i + 1} port`} placeholder="port" value={b.port} onChange={(e) => setBackends((r) => r.map((x, j) => (j === i ? { ...x, port: e.target.value } : x)))} />
                <Button size="sm" variant="ghost" aria-label={`Remove backend ${i + 1}`} onClick={() => setBackends((r) => r.filter((_, j) => j !== i))}><X size={14} /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setBackends((r) => [...r, { name: "", address: "", port: "" }])}><Plus size={14} /> Add backend</Button>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Ports</h3>
            {ports.map((p, i) => (
              <div key={i} className="mb-1 grid grid-cols-[5rem_1fr_1.4fr_auto] items-end gap-1">
                <Select aria-label={`Port ${i + 1} protocol`} value={p.protocol} onChange={(e) => setPorts((r) => r.map((x, j) => (j === i ? { ...x, protocol: e.target.value as "tcp" | "udp" } : x)))}>
                  <option value="tcp">tcp</option>
                  <option value="udp">udp</option>
                </Select>
                <Input aria-label={`Port ${i + 1} listen port`} placeholder="listen port(s)" data-testid={`lb-port-listen-${i}`} value={p.listenPort} onChange={(e) => setPorts((r) => r.map((x, j) => (j === i ? { ...x, listenPort: e.target.value } : x)))} />
                <Input aria-label={`Port ${i + 1} target backends`} placeholder="backends (comma separated)" data-testid={`lb-port-backends-${i}`} value={p.backends} onChange={(e) => setPorts((r) => r.map((x, j) => (j === i ? { ...x, backends: e.target.value } : x)))} />
                <Button size="sm" variant="ghost" aria-label={`Remove port ${i + 1}`} onClick={() => setPorts((r) => r.filter((_, j) => j !== i))}><X size={14} /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setPorts((r) => [...r, { protocol: "tcp", listenPort: "", backends: "" }])}><Plus size={14} /> Add port</Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={peerOpen}
        onClose={() => setPeerOpen(false)}
        title={`Add peer to ${name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPeerOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={createPeer} loading={busy} data-testid="peer-create-submit"><Plus size={14} /> Create</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Peer name" name="peer-name" data-testid="peer-name" value={peerName} onChange={(e) => setPeerName(e.target.value)} />
          <Input label="Target project" name="peer-project" data-testid="peer-project" value={peerProject} onChange={(e) => setPeerProject(e.target.value)} />
          <Input label="Target network" name="peer-network" data-testid="peer-network" value={peerNetwork} onChange={(e) => setPeerNetwork(e.target.value)} />
          <p className="text-xs text-text-tertiary">A peering only becomes active once the same peering is created from the target network back to this one.</p>
        </div>
      </Dialog>

      <ConfirmDialog open={lbDelete !== null} title="Delete load balancer" body={`Delete load balancer ${lbDelete?.listen_address}?`} confirmLabel="Delete" tone="danger" onConfirm={removeLb} onCancel={() => setLbDelete(null)} />
      <ConfirmDialog open={peerDelete !== null} title="Delete peer" body={`Delete peer ${peerDelete?.name}?`} confirmLabel="Delete" tone="danger" onConfirm={removePeer} onCancel={() => setPeerDelete(null)} />
    </>
  );
}
