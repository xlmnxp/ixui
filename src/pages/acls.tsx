import { useCallback, useEffect, useState } from "react";
import { Ban, Check, FileText, Pencil, Play, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { networkExtrasApi } from "../api";
import { ApiError } from "../api/client";
import type { Acl } from "../api/network-extras";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Window } from "../components/window";
import { Dropdown } from "../components/dropdown";
import { Input } from "../components/input";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import { toast } from "../components/toast";

const PROTOCOLS = [
  { value: "", label: "All protocols" },
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "icmp4", label: "ICMPv4" },
  { value: "icmp6", label: "ICMPv6" },
  { value: "esp", label: "ESP" },
  { value: "gre", label: "GRE" },
] as const;

export interface AclRule {
  action?: string;
  state?: string;
  protocol?: string;
  source?: string;
  destination?: string;
  source_port?: string;
  destination_port?: string;
  icmp_type?: string;
  icmp_code?: string;
  description?: string;
}

type Direction = "ingress" | "egress";

const selectClass = "h-7 w-full rounded border border-border bg-surface-500 px-1 text-xs text-text-primary focus:border-accent-500 focus:outline-none";
const inputClass = "h-7 w-full min-w-0 rounded border border-border bg-surface-500 px-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none";

interface CellSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  dataTestId: string;
}

function CellSelect({ value, onChange, options, dataTestId }: CellSelectProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={dataTestId} className={selectClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

const ACTION_OPTIONS = [
  { value: "allow", label: "allow", icon: <Check size={12} className="text-success" /> },
  { value: "drop", label: "drop", icon: <X size={12} className="text-text-tertiary" /> },
  { value: "reject", label: "reject", icon: <ShieldAlert size={12} className="text-danger" /> },
];

interface CellInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  dataTestId: string;
  className?: string;
}

function CellInput({ value, onChange, placeholder, dataTestId, className = "" }: CellInputProps) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={dataTestId}
      className={`${inputClass} ${className}`}
    />
  );
}

export function AclsPage() {
  const [acls, setAcls] = useState<Acl[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Acl | null>(null);
  const [editing, setEditing] = useState<Acl | null>(null);
  const [draftIngress, setDraftIngress] = useState<AclRule[]>([]);
  const [draftEgress, setDraftEgress] = useState<AclRule[]>([]);
  const [rulesBusy, setRulesBusy] = useState(false);
  const [removeRuleTarget, setRemoveRuleTarget] = useState<{ direction: Direction; index: number } | null>(null);

  const refresh = useCallback(() => {
    void networkExtrasApi
      .listAcls()
      .then(setAcls)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await networkExtrasApi.createAcl({ name: name.trim(), description: description.trim() });
      toast("success", `ACL ${name.trim()} created`);
      setCreateOpen(false);
      setName("");
      setDescription("");
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
      await networkExtrasApi.deleteAcl(deleteTarget.name);
      toast("success", `ACL ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const openRules = (acl: Acl) => {
    setEditing(acl);
    setDraftIngress([...(acl.ingress as AclRule[])]);
    setDraftEgress([...(acl.egress as AclRule[])]);
  };

  const cleanRules = (rules: AclRule[]): AclRule[] =>
    rules.map((r) => {
      const next: AclRule = { action: r.action ?? "allow", state: r.state ?? "enabled" };
      if (r.protocol) next.protocol = r.protocol;
      if (r.source) next.source = r.source;
      if (r.destination) next.destination = r.destination;
      if (r.source_port) next.source_port = r.source_port;
      if (r.destination_port) next.destination_port = r.destination_port;
      if (r.icmp_type) next.icmp_type = r.icmp_type;
      if (r.icmp_code) next.icmp_code = r.icmp_code;
      if (r.description) next.description = r.description;
      return next;
    });

  const saveRules = async () => {
    if (!editing) return;
    setRulesBusy(true);
    try {
      await networkExtrasApi.updateAcl(editing.name, { ingress: cleanRules(draftIngress), egress: cleanRules(draftEgress) });
      toast("success", `Rules for ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setRulesBusy(false);
    }
  };

  const updateRule = (rules: AclRule[], index: number, patch: Partial<AclRule>): AclRule[] =>
    rules.map((r, i) => (i === index ? { ...r, ...patch } : r));

  const confirmRemoveRule = () => {
    if (!removeRuleTarget) return;
    const { direction, index } = removeRuleTarget;
    if (direction === "ingress") setDraftIngress((prev) => prev.filter((_, j) => j !== index));
    else setDraftEgress((prev) => prev.filter((_, j) => j !== index));
    setRemoveRuleTarget(null);
  };

  const columns: Column<Acl>[] = [
    { key: "name", header: "Name", sortValue: (a) => a.name, render: (a) => <span className="font-medium">{a.name}</span> },
    { key: "description", header: "Description", render: (a) => a.description || "—" },
    { key: "ingress", header: "Ingress", render: (a) => String(a.ingress.length) },
    { key: "egress", header: "Egress", render: (a) => String(a.egress.length) },
    { key: "used_by", header: "Used by", render: (a) => (a.used_by.length > 0 ? a.used_by.join(", ") : "—") },
    {
      key: "actions", header: "", align: "right",
      render: (a) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`acl-rules-${a.name}`} onClick={() => openRules(a)}><Pencil size={14} /> Rules</Button>
          <Button size="sm" variant="ghost" data-testid={`acl-delete-${a.name}`} onClick={() => setDeleteTarget(a)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const ruleSection = (prefix: Direction, title: string, rules: AclRule[], setRules: (rules: AclRule[]) => void) => (
    <div data-testid={`acl-${prefix}-section`}>
      <div className="mb-1 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title} ({rules.length})</h4>
        <Button size="sm" variant="secondary" data-testid={`acl-add-${prefix}`} onClick={() => setRules([...rules, {}])}><Plus size={13} /> Add {prefix} rules</Button>
      </div>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]">
          <thead className="bg-surface-700 text-left text-xs text-text-secondary">
            <tr>
              <th className="w-24 border-b border-border px-2 py-1 font-normal">Action</th>
              <th className="w-16 border-b border-border px-2 py-1 text-center font-normal">State</th>
              <th className="w-28 border-b border-border px-2 py-1 font-normal">Protocol</th>
              <th className="border-b border-border px-2 py-1 font-normal">Source</th>
              <th className="border-b border-border px-2 py-1 font-normal">Destination</th>
              <th className="w-20 border-b border-border px-2 py-1 font-normal">Src port</th>
              <th className="w-20 border-b border-border px-2 py-1 font-normal">Dst port</th>
              <th className="w-14 border-b border-border px-2 py-1 font-normal">ICMP type</th>
              <th className="w-14 border-b border-border px-2 py-1 font-normal">Code</th>
              <th className="border-b border-border px-2 py-1 font-normal">Description</th>
              <th className="w-8 border-b border-border px-2 py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface-800">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-2 py-2 text-xs text-text-tertiary">No {prefix} rules. Click "Add {prefix} rules" to create the first one.</td>
              </tr>
            ) : (
              rules.map((r, i) => {
                const isDisabled = r.state === "disabled";
                const isLogged = r.state === "logged";
                return (
                <tr key={i} data-testid={`acl-${prefix}-rule-${i}`} className={isDisabled ? "opacity-50" : ""}>
                  <td className="px-2 py-1">
                    <Dropdown
                      value={r.action ?? "allow"}
                      onChange={(v) => setRules(updateRule(rules, i, { action: v }))}
                      options={ACTION_OPTIONS}
                      dataTestId={`acl-${prefix}-action-${i}`}
                      size="sm"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        data-testid={`acl-${prefix}-toggle-${i}`}
                        onClick={() => setRules(updateRule(rules, i, { state: isDisabled ? "enabled" : "disabled" }))}
                        title={isDisabled ? "Enable rule" : "Disable rule"}
                        aria-label={isDisabled ? "Enable rule" : "Disable rule"}
                        className={isDisabled ? "text-text-tertiary hover:text-text-primary" : "text-success hover:opacity-80"}
                      >
                        {isDisabled ? <Ban size={14} /> : <Play size={14} className="fill-current" />}
                      </button>
                      <button
                        type="button"
                        data-testid={`acl-${prefix}-log-${i}`}
                        disabled={isDisabled}
                        onClick={() => setRules(updateRule(rules, i, { state: isLogged ? "enabled" : "logged" }))}
                        title={isLogged ? "Disable logging" : "Enable logging"}
                        aria-label={isLogged ? "Disable logging" : "Enable logging"}
                        className={isLogged ? "text-accent-400 hover:opacity-80" : "text-text-tertiary hover:text-text-primary disabled:opacity-40"}
                      >
                        <FileText size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1">
                    <CellSelect
                      value={r.protocol ?? ""}
                      onChange={(v) => setRules(updateRule(rules, i, { protocol: v }))}
                      options={PROTOCOLS}
                      dataTestId={`acl-${prefix}-protocol-${i}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.source ?? ""} onChange={(v) => setRules(updateRule(rules, i, { source: v }))} placeholder="0.0.0.0/0" dataTestId={`acl-${prefix}-source-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.destination ?? ""} onChange={(v) => setRules(updateRule(rules, i, { destination: v }))} placeholder="0.0.0.0/0" dataTestId={`acl-${prefix}-destination-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.source_port ?? ""} onChange={(v) => setRules(updateRule(rules, i, { source_port: v }))} placeholder="All" dataTestId={`acl-${prefix}-srcport-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.destination_port ?? ""} onChange={(v) => setRules(updateRule(rules, i, { destination_port: v }))} placeholder="All" dataTestId={`acl-${prefix}-dstport-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.icmp_type ?? ""} onChange={(v) => setRules(updateRule(rules, i, { icmp_type: v }))} placeholder="type" dataTestId={`acl-${prefix}-icmptype-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.icmp_code ?? ""} onChange={(v) => setRules(updateRule(rules, i, { icmp_code: v }))} placeholder="code" dataTestId={`acl-${prefix}-icmpcode-${i}`} />
                  </td>
                  <td className="px-2 py-1">
                    <CellInput value={r.description ?? ""} onChange={(v) => setRules(updateRule(rules, i, { description: v }))} placeholder="Optional" dataTestId={`acl-${prefix}-description-${i}`} />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <button type="button" data-testid={`acl-${prefix}-remove-${i}`} onClick={() => setRemoveRuleTarget({ direction: prefix, index: i })} className="text-text-tertiary hover:text-danger" aria-label={`Remove ${prefix} rule`}><Trash2 size={12} /></button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div data-testid="acls-page">
      <PageBar
        title="Network ACLs"
        actions={[
          <Button key="create" size="sm" data-testid="acl-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create ACL</Button>,
        ]}
      />

      {denied ? (
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view network ACLs." />
        </div>
      ) : loading ? (
        <Loading dataTestId="acls-loading" label="Loading network ACLs…" />
      ) : acls.length === 0 ? (
        <EmptyState title="No network ACLs" description="ACLs define allow/deny rules applied to NIC devices." />
      ) : (
        <Table columns={columns} rows={acls} rowKey={(a) => a.name} dataTestId="acls-table" stickyHeaderOffset={40} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create ACL" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} disabled={!name.trim()} data-testid="acl-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="acl-name" data-testid="acl-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" name="acl-desc" data-testid="acl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={removeRuleTarget !== null}
        title={`Remove ${removeRuleTarget?.direction ?? ""} rule`}
        body="Remove this rule from the ACL? It will be applied when you save the rules."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={confirmRemoveRule}
        onCancel={() => setRemoveRuleTarget(null)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ACL ${deleteTarget?.name ?? ""}`}
        body={`Delete the ${deleteTarget?.name ?? ""} network ACL? Networks using it will lose their rules.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Window
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`ACL ${editing?.name ?? ""}`}
        subtitle={`${draftIngress.length} ingress rules · ${draftEgress.length} egress rules`}
        width={1100}
        bodyMaxHeight={560}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
            <Button onClick={saveRules} loading={rulesBusy} data-testid="acl-rules-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          {ruleSection("ingress", "Ingress rules", draftIngress, setDraftIngress)}
          {ruleSection("egress", "Egress rules", draftEgress, setDraftEgress)}
        </div>
      </Window>
    </div>
  );
}
