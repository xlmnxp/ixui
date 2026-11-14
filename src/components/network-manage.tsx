import { useCallback, useEffect, useMemo, useState } from "react";
import { Network as NetworkIcon, Plus, Save, Trash2 } from "lucide-react";
import { infraApi, networkExtrasApi } from "../api";
import type { Network } from "../api/types";
import type { Forward, Lease } from "../api/network-extras";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";
import { Input } from "./input";
import { KeyValueEditor } from "./key-value-editor";
import { Loading } from "./loading";
import { Table } from "./table";
import type { Column } from "./table";
import { Tabs } from "./tabs";
import { NetworkLinksPanel } from "./network-links";
import { toast } from "./toast";
import { Window } from "./window";

type Tab = "settings" | "leases" | "forwards" | "lbs" | "peers";

/** Address the daemon has configured for a family, or undefined when disabled. */
function prefix(network: Network, family: "ipv4" | "ipv6"): string | undefined {
  const value = network.config?.[`${family}.address`];
  if (!value || value === "none" || value === "auto") return undefined;
  return value;
}

export interface NetworkManageWindowProps {
  network: Network | null;
  onClose: () => void;
  /** Called after a change that the list should pick up. */
  onChanged: () => void;
}

/** Everything about one network in a single window: settings, leases and forwards. */
export function NetworkManageWindow({ network, onClose, onChanged }: NetworkManageWindowProps) {
  const [tab, setTab] = useState<Tab>("settings");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [forwards, setForwards] = useState<Forward[]>([]);
  const [loading, setLoading] = useState(false);
  const [listen, setListen] = useState("");
  const [forwardDesc, setForwardDesc] = useState("");
  const [forwardBusy, setForwardBusy] = useState(false);
  const [forwardDelete, setForwardDelete] = useState<Forward | null>(null);
  /** ACL names, so security.acls values can be completed. */
  const [aclOptions, setAclOptions] = useState<Record<string, string[]>>({});

  const name = network?.name ?? "";
  const managed = network?.managed ?? false;
  const ipv4 = network ? prefix(network, "ipv4") : undefined;
  const ipv6 = network ? prefix(network, "ipv6") : undefined;

  const load = useCallback(async () => {
    if (!name) return;
    setLoading(true);
    try {
      const [fresh, l, f] = await Promise.all([
        infraApi.getNetwork(name),
        networkExtrasApi.listLeases(name).catch(() => []),
        networkExtrasApi.listForwards(name).catch(() => []),
      ]);
      setDescription(fresh.description ?? "");
      setConfig(fresh.config ?? {});
      setInitial(JSON.stringify([fresh.description ?? "", fresh.config ?? {}]));
      setLeases(l);
      setForwards(f);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    if (!network) return;
    setTab("settings");
    setListen("");
    setForwardDesc("");
    void load();
  }, [network, load]);

  useEffect(() => {
    void networkExtrasApi
      .listAcls()
      .then((acls) => setAclOptions({ acls: acls.map((a) => a.name) }))
      .catch(() => {});
  }, []);

  const dirty = JSON.stringify([description, config]) !== initial;

  const save = async () => {
    if (!network) return;
    setSaving(true);
    try {
      await infraApi.updateNetworkConfig(network.name, { description: description.trim(), config });
      toast("success", `Network ${network.name} saved`);
      await load();
      onChanged();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addForward = async () => {
    if (!network || !listen.trim()) return;
    setForwardBusy(true);
    try {
      await networkExtrasApi.createForward(network.name, { listen_address: listen.trim(), description: forwardDesc.trim() });
      toast("success", `Forward ${listen.trim()} created`);
      setListen("");
      setForwardDesc("");
      setForwards(await networkExtrasApi.listForwards(network.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setForwardBusy(false);
    }
  };

  const removeForward = async () => {
    if (!network || !forwardDelete) return;
    try {
      await networkExtrasApi.deleteForward(network.name, forwardDelete.listen_address);
      toast("success", `Forward ${forwardDelete.listen_address} deleted`);
      setForwardDelete(null);
      setForwards(await networkExtrasApi.listForwards(network.name));
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const leaseColumns: Column<Lease>[] = useMemo(
    () => [
      { key: "address", header: "Address", render: (l) => <span className="font-mono text-xs">{l.address}</span> },
      { key: "hostname", header: "Hostname", render: (l) => l.hostname || "—" },
      { key: "hwaddr", header: "MAC", render: (l) => <span className="font-mono text-xs">{l.hwaddr}</span> },
      { key: "type", header: "Type", render: (l) => l.type },
      { key: "expires", header: "Expires", render: (l) => l.expires_at },
    ],
    []
  );

  const forwardColumns: Column<Forward>[] = useMemo(
    () => [
      { key: "listen", header: "Listen address", render: (f) => <span className="font-mono text-xs">{f.listen_address}</span> },
      { key: "desc", header: "Description", render: (f) => f.description || "—" },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (f) => (
          <Button size="sm" variant="ghost" data-testid={`network-forward-delete-${f.listen_address}`} onClick={() => setForwardDelete(f)}>
            <Trash2 size={14} /> Delete
          </Button>
        ),
      },
    ],
    []
  );

  if (!network) return null;

  return (
    <>
      <Window
        open
        onClose={onClose}
        title={`Network ${network.name}`}
        subtitle={`${network.type}${managed ? " · managed" : ""}`}
        icon={<NetworkIcon size={15} />}
        width={1000}
        bodyMaxHeight="min(620px, calc(100vh - 200px))"
        dirty={dirty}
        discardMessage="This network has unsaved settings. Discard them?"
        renderFooter={(close) => (
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" onClick={close} data-testid="network-manage-close">Close</Button>
            {tab === "settings" && (
              <Button onClick={save} loading={saving} disabled={!dirty} data-testid="network-manage-save">
                <Save size={14} /> Save settings
              </Button>
            )}
          </div>
        )}
      >
        <div data-testid="network-manage">
          <Tabs
            tabs={[
              { key: "settings", label: "Settings" },
              { key: "leases", label: "Leases" },
              { key: "forwards", label: "Forwards" },
              { key: "lbs", label: "Load balancers" },
              ...(network.type === "ovn" ? [{ key: "peers", label: "Peers" }] : []),
            ]}
            active={tab}
            onChange={(key) => setTab(key as Tab)}
          />

          {loading ? (
            <Loading dataTestId="network-manage-loading" label="Loading network…" />
          ) : (
            <div className="pt-3">
              {tab === "settings" && (
                <div className="space-y-3" data-testid="network-settings">
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <div className="flex justify-between gap-3 border-b border-border py-1">
                      <dt className="text-text-secondary">Type</dt>
                      <dd className="text-text-primary">{network.type}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-border py-1">
                      <dt className="text-text-secondary">Managed</dt>
                      <dd className="text-text-primary">{managed ? "Yes" : "No"}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-border py-1">
                      <dt className="text-text-secondary">IPv4 prefix</dt>
                      <dd className="font-mono text-text-primary" data-testid="network-prefix-ipv4">{ipv4 ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3 border-b border-border py-1">
                      <dt className="text-text-secondary">IPv6 prefix</dt>
                      <dd className="font-mono text-text-primary" data-testid="network-prefix-ipv6">{ipv6 ?? "—"}</dd>
                    </div>
                  </dl>

                  <Input
                    label="Description"
                    name="network-manage-desc"
                    placeholder="Optional"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />

                  <div>
                    <p className="mb-1 text-xs font-medium text-text-secondary">Configuration</p>
                    <KeyValueEditor
                      values={config}
                      onChange={setConfig}
                      dataTestId="network-manage-config"
                      valueOptions={aclOptions}
                      stickyHeader
                    />
                  </div>
                </div>
              )}

              {tab === "leases" && (
                <div data-testid="network-leases">
                  {leases.length === 0 ? (
                    <EmptyState title="No leases" description="Addresses handed out by this network’s DHCP server appear here." />
                  ) : (
                    <Table columns={leaseColumns} rows={leases} rowKey={(l) => l.hwaddr + l.address} />
                  )}
                </div>
              )}

              {(tab === "lbs" || tab === "peers") && (
                <div data-testid="network-links">
                  <NetworkLinksPanel network={network} kind={tab} showTabs={false} />
                </div>
              )}

              {tab === "forwards" && (
                <div className="space-y-3" data-testid="network-forwards">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input label="Listen address" name="network-forward-address" placeholder="10.0.0.1:8080" data-testid="network-forward-address" value={listen} onChange={(e) => setListen(e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <Input label="Description" name="network-forward-desc" placeholder="Optional" data-testid="network-forward-description" value={forwardDesc} onChange={(e) => setForwardDesc(e.target.value)} />
                    </div>
                    <Button size="sm" onClick={addForward} loading={forwardBusy} disabled={!listen.trim()} data-testid="network-forward-create">
                      <Plus size={14} /> Add
                    </Button>
                  </div>
                  {forwards.length === 0 ? (
                    <EmptyState title="No forwards" description="Proxy a host port to an instance address." />
                  ) : (
                    <Table columns={forwardColumns} rows={forwards} rowKey={(f) => f.listen_address} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Window>

      <ConfirmDialog
        open={forwardDelete !== null}
        title="Delete forward"
        body={`Delete forward ${forwardDelete?.listen_address ?? ""}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void removeForward()}
        onCancel={() => setForwardDelete(null)}
      />
    </>
  );
}