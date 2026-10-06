import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { networkExtrasApi } from "../api";
import { ApiError } from "../api/client";
import type { AddressSet, Zone } from "../api/network-extras";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { ReviewList, StepDialog } from "../components/step-dialog";
import type { Step } from "../components/step-dialog";
import { KeyValueEditor } from "../components/key-value-editor";
import { isValidAddressOrCidr } from "../lib/ip";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Textarea } from "../components/textarea";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

type Kind = "zones" | "sets";
type PageProps = { registerBar?: (bar: BarState | null) => void };

const splitLines = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((l) => l.trim())
    .filter(Boolean);

const usedBy = (o: { used_by?: string[] }) => (o.used_by && o.used_by.length > 0 ? `${o.used_by.length}` : "—");

const COPY = {
  zones: { title: "Network zones", noun: "zone", empty: "No network zones", testPrefix: "zones" },
  sets: { title: "Address sets", noun: "address set", empty: "No address sets", testPrefix: "sets" },
} as const;

/** Both are project-scoped lists with the same create/edit/delete flow; `kind` picks the API and columns. */
function NetworkObjectsPage({ kind, registerBar }: PageProps & { kind: Kind }) {
  const copy = COPY[kind];
  const [items, setItems] = useState<(Zone | AddressSet)[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [editor, setEditor] = useState<{ existing: string | null } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [addresses, setAddresses] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const load = kind === "zones" ? networkExtrasApi.listZones() : networkExtrasApi.listAddressSets();
    void load
      .then(setItems)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
        else toast("danger", err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(refresh, [refresh]);

  const openCreate = useCallback(() => {
    setEditor({ existing: null });
    setName("");
    setDescription("");
    setAddresses("");
    setConfig({});
  }, []);

  const openEdit = (obj: Zone | AddressSet) => {
    setEditor({ existing: obj.name });
    setName(obj.name);
    setDescription(obj.description);
    setAddresses("addresses" in obj ? obj.addresses.join("\n") : "");
    setConfig("config" in obj && obj.config ? obj.config : {});
  };

  const save = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      const desc = description.trim();
      if (kind === "zones") {
        if (editor.existing) await networkExtrasApi.updateZone(editor.existing, { description: desc, config });
        else await networkExtrasApi.createZone({ name: name.trim(), description: desc, config });
      } else if (editor.existing) {
        await networkExtrasApi.updateAddressSet(editor.existing, { description: desc, addresses: splitLines(addresses) });
      } else {
        await networkExtrasApi.createAddressSet({ name: name.trim(), description: desc, addresses: splitLines(addresses) });
      }
      toast("success", `${editor.existing ? "Saved" : "Created"} ${editor.existing ?? name.trim()}`);
      setEditor(null);
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
      if (kind === "zones") await networkExtrasApi.deleteZone(deleteTarget);
      else await networkExtrasApi.deleteAddressSet(deleteTarget);
      toast("success", `Deleted ${deleteTarget}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Zone | AddressSet>[] = [
    { key: "name", header: "Name", sortValue: (o) => o.name, render: (o) => <span className="font-medium">{o.name}</span> },
    { key: "description", header: "Description", render: (o) => o.description || "—" },
    ...(kind === "sets"
      ? [{
          key: "addresses", header: "Addresses",
          render: (o: Zone | AddressSet) => {
            const list = "addresses" in o ? o.addresses : [];
            return <span className="text-xs text-text-secondary">{list.length > 0 ? list.join(", ") : "—"}</span>;
          },
        }]
      : []),
    { key: "used", header: "Used by", render: usedBy },
    {
      key: "actions", header: "", align: "right",
      render: (o) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`${copy.testPrefix}-edit-${o.name}`} onClick={() => openEdit(o)}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`${copy.testPrefix}-delete-${o.name}`} onClick={() => setDeleteTarget(o.name)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const barActions: ReactNode[] = useMemo(
    () => [<Button key="create" size="sm" data-testid="netobj-create-open" onClick={openCreate}><Plus size={14} /> Create {copy.noun}</Button>],
    [openCreate, copy.noun],
  );

  useEffect(() => {
    registerBar?.({ title: copy.title, actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions, copy.title]);

  const invalidAddresses = kind === "sets" ? splitLines(addresses).filter((a) => !isValidAddressOrCidr(a)) : [];
  const addressList = splitLines(addresses);

  const basics: Step = {
    key: "basics",
    title: "Basics",
    invalid: name.trim() ? null : `Enter a ${copy.noun} name`,
    content: (
      <div className="space-y-3">
        <Input
          label={kind === "zones" ? "Zone name (DNS domain, e.g. example.org)" : "Name"}
          name="netobj-name"
          data-testid="netobj-name"
          value={name}
          disabled={editor?.existing != null}
          onChange={(e) => setName(e.target.value)}
        />
        <Input label="Description" name="netobj-desc" data-testid="netobj-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    ),
  };

  const steps: Step[] =
    kind === "zones"
      ? [
          basics,
          {
            key: "settings",
            title: "Settings",
            content: (
              <div className="space-y-2">
                <p className="text-xs text-text-tertiary">
                  Optional. Common keys: <code>dns.nameservers</code>, <code>network.nat</code>, <code>peers.NAME.address</code>, <code>peers.NAME.key</code>.
                </p>
                <KeyValueEditor values={config} onChange={setConfig} dataTestId="zone-config-editor" stickyHeader />
              </div>
            ),
          },
          {
            key: "review",
            title: "Review",
            content: (
              <ReviewList
                rows={[
                  { label: "Zone", value: name || "—" },
                  { label: "Description", value: description || "—" },
                  { label: "Settings", value: Object.keys(config).length === 0 ? "None" : Object.entries(config).map(([k, v]) => `${k}=${v}`).join(", ") },
                ]}
              />
            ),
          },
        ]
      : [
          basics,
          {
            key: "addresses",
            title: "Addresses",
            invalid: invalidAddresses.length > 0 ? `Not a valid IP or CIDR: ${invalidAddresses.slice(0, 3).join(", ")}${invalidAddresses.length > 3 ? "…" : ""}` : null,
            content: (
              <div className="space-y-2">
                <Textarea label="Addresses (one per line, IPs or CIDRs)" name="netobj-addresses" data-testid="netobj-addresses" rows={8} value={addresses} onChange={(e) => setAddresses(e.target.value)} />
                <p className="text-xs text-text-tertiary" data-testid="address-count">
                  {addressList.length} address{addressList.length === 1 ? "" : "es"}{invalidAddresses.length > 0 ? ` · ${invalidAddresses.length} invalid` : ""}
                </p>
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
                  { label: "Description", value: description || "—" },
                  { label: "Addresses", value: addressList.length === 0 ? "None" : <span className="font-mono text-xs">{addressList.join(", ")}</span> },
                ]}
              />
            ),
          },
        ];

  return (
    <div data-testid={`${copy.testPrefix}-page`}>
      {!registerBar && <PageBar title={copy.title} actions={barActions} />}

      {denied ? (
        <EmptyState title="Permission denied" description={`Your account does not have permission to view ${copy.title.toLowerCase()}.`} />
      ) : loading ? (
        <Loading dataTestId="network-objects-loading" label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState title={copy.empty} />
      ) : (
        <Table columns={columns} rows={items} rowKey={(o) => o.name} persistKey={kind === "zones" ? "zones" : "address-sets"} dataTestId={`${copy.testPrefix}-table`} />
      )}

      <StepDialog
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={`${editor?.existing ? "Edit" : "Create"} ${copy.noun}`}
        submitLabel={editor?.existing ? "Save" : "Create"}
        submitIcon={editor?.existing ? undefined : <Plus size={14} />}
        busy={busy}
        wide
        freeNavigation={editor?.existing != null}
        onSubmit={save}
        steps={steps}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${copy.noun}`}
        body={`Delete ${deleteTarget}? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export const NetworkZonesPage = (props: PageProps = {}) => <NetworkObjectsPage kind="zones" {...props} />;
export const AddressSetsPage = (props: PageProps = {}) => <NetworkObjectsPage kind="sets" {...props} />;
