import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { networkExtrasApi } from "../api";
import { ApiError } from "../api/client";
import type { Acl } from "../api/network-extras";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import { toast } from "../components/toast";

const ACTIONS = ["allow", "drop", "reject"] as const;
const STATES = ["enabled", "disabled", "logged"] as const;

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

const ruleSummary = (r: AclRule): string => {
  const parts = [
    r.action ?? "allow",
    r.state && r.state !== "enabled" ? r.state : "",
    r.protocol,
    r.source,
    r.destination ? `→ ${r.destination}` : "",
    r.source_port || r.destination_port ? `ports ${r.source_port ?? "*"}→${r.destination_port ?? "*"}` : "",
    r.icmp_type !== undefined && r.icmp_type !== "" ? `icmp ${r.icmp_type}/${r.icmp_code ?? "0"}` : "",
  ].filter((p) => p !== "");
  return parts.join(" ") || "—";
};

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
  const [ruleEditor, setRuleEditor] = useState<{ direction: Direction } | null>(null);
  const [rule, setRule] = useState<AclRule>({ action: "allow", state: "enabled" });

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

  const saveRules = async () => {
    if (!editing) return;
    setRulesBusy(true);
    try {
      await networkExtrasApi.updateAcl(editing.name, { ingress: draftIngress, egress: draftEgress });
      toast("success", `Rules for ${editing.name} saved`);
      setEditing(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setRulesBusy(false);
    }
  };

  const addRule = () => {
    if (!ruleEditor) return;
    const next: AclRule = { ...rule, action: rule.action || "allow", state: rule.state || "enabled" };
    if (ruleEditor.direction === "ingress") setDraftIngress((prev) => [...prev, next]);
    else setDraftEgress((prev) => [...prev, next]);
    setRuleEditor(null);
  };

  const removeRule = (direction: Direction, index: number) => {
    if (direction === "ingress") setDraftIngress((prev) => prev.filter((_, i) => i !== index));
    else setDraftEgress((prev) => prev.filter((_, i) => i !== index));
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

  const ruleList = (direction: Direction, rules: AclRule[]) => (
    <div className="space-y-1" data-testid={`acl-${direction}-list`}>
      {rules.length === 0 ? (
        <p className="rounded border border-dashed border-border px-2 py-2 text-xs text-text-tertiary">No {direction} rules.</p>
      ) : (
        rules.map((r, i) => (
          <div key={i} data-testid={`acl-${direction}-rule-${i}`} className="flex items-center gap-2 rounded border border-border bg-surface-800 px-2 py-1">
            <code className="min-w-0 flex-1 truncate text-xs text-text-primary">{ruleSummary(r)}</code>
            {r.description && <span className="max-w-40 truncate text-[11px] text-text-tertiary">{r.description}</span>}
            <button type="button" data-testid={`acl-${direction}-remove-${i}`} onClick={() => removeRule(direction, i)} className="text-text-tertiary hover:text-danger" aria-label={`Remove ${direction} rule`}><X size={12} /></button>
          </div>
        ))
      )}
    </div>
  );

  const ruleEditorFields = (
    <div className="grid grid-cols-2 gap-3">
      <Select label="Action" name="rule-action" data-testid="rule-action" value={rule.action ?? "allow"} onChange={(e) => setRule({ ...rule, action: e.target.value })}>
        {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </Select>
      <Select label="State" name="rule-state" data-testid="rule-state" value={rule.state ?? "enabled"} onChange={(e) => setRule({ ...rule, state: e.target.value })}>
        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Input label="Protocol" name="rule-protocol" data-testid="rule-protocol" value={rule.protocol ?? ""} onChange={(e) => setRule({ ...rule, protocol: e.target.value })} placeholder="tcp, udp, icmp4, icmp6…" />
      <Input label="Description" name="rule-description" data-testid="rule-description" value={rule.description ?? ""} onChange={(e) => setRule({ ...rule, description: e.target.value })} />
      <Input label="Source" name="rule-source" data-testid="rule-source" value={rule.source ?? ""} onChange={(e) => setRule({ ...rule, source: e.target.value })} placeholder="10.0.0.0/24 or @security-group" />
      <Input label="Destination" name="rule-destination" data-testid="rule-destination" value={rule.destination ?? ""} onChange={(e) => setRule({ ...rule, destination: e.target.value })} placeholder="10.0.0.0/24 or @security-group" />
      <Input label="Source port" name="rule-source-port" data-testid="rule-source-port" value={rule.source_port ?? ""} onChange={(e) => setRule({ ...rule, source_port: e.target.value })} placeholder="80 or 1000-2000" />
      <Input label="Destination port" name="rule-destination-port" data-testid="rule-destination-port" value={rule.destination_port ?? ""} onChange={(e) => setRule({ ...rule, destination_port: e.target.value })} placeholder="443 or 1000-2000" />
      <Input label="ICMP type" name="rule-icmp-type" data-testid="rule-icmp-type" value={rule.icmp_type ?? ""} onChange={(e) => setRule({ ...rule, icmp_type: e.target.value })} placeholder="8" />
      <Input label="ICMP code" name="rule-icmp-code" data-testid="rule-icmp-code" value={rule.icmp_code ?? ""} onChange={(e) => setRule({ ...rule, icmp_code: e.target.value })} placeholder="0" />
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
        open={deleteTarget !== null}
        title={`Delete ACL ${deleteTarget?.name ?? ""}`}
        body={`Delete the ${deleteTarget?.name ?? ""} network ACL? Networks using it will lose their rules.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`ACL ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
          <Button onClick={saveRules} loading={rulesBusy} data-testid="acl-rules-save"><Check size={14} /> Save</Button>
        </>
      }>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Ingress ({draftIngress.length})</h4>
              <Button size="sm" variant="secondary" data-testid="acl-add-ingress" onClick={() => { setRule({ action: "allow", state: "enabled" }); setRuleEditor({ direction: "ingress" }); }}><Plus size={13} /> Add rule</Button>
            </div>
            {ruleList("ingress", draftIngress)}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Egress ({draftEgress.length})</h4>
              <Button size="sm" variant="secondary" data-testid="acl-add-egress" onClick={() => { setRule({ action: "allow", state: "enabled" }); setRuleEditor({ direction: "egress" }); }}><Plus size={13} /> Add rule</Button>
            </div>
            {ruleList("egress", draftEgress)}
          </div>
        </div>
      </Dialog>

      <Dialog open={ruleEditor !== null} onClose={() => setRuleEditor(null)} title={`Add ${ruleEditor?.direction ?? ""} rule`} footer={
        <>
          <Button variant="secondary" onClick={() => setRuleEditor(null)}><X size={14} /> Cancel</Button>
          <Button onClick={addRule} data-testid="rule-add-submit"><Plus size={14} /> Add rule</Button>
        </>
      }>
        {ruleEditorFields}
      </Dialog>
    </div>
  );
}
