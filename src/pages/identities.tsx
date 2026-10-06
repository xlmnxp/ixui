import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { authApi } from "../api";
import { ApiError } from "../api/client";
import type { AuthGroup, Identity, Permission } from "../api/auth";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { VerticalTabs } from "../components/vertical-tabs";
import { SplitPane } from "../components/split-pane";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Checkbox } from "../components/checkbox";
import { Input } from "../components/input";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import { toast } from "../components/toast";

type Tab = "identities" | "groups";

const idKey = (i: Identity): string => `${i.authentication_method}/${i.identifier}`;

export function IdentitiesPage() {
  const [tab, setTab] = useState<Tab>("identities");
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [groups, setGroups] = useState<AuthGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editIdentity, setEditIdentity] = useState<Identity | null>(null);
  const [identityGroups, setIdentityGroups] = useState<string[]>([]);
  const [deleteIdentity, setDeleteIdentity] = useState<Identity | null>(null);

  const [groupDialog, setGroupDialog] = useState<{ existing: AuthGroup | null } | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [perms, setPerms] = useState<Permission[]>([]);
  const [deleteGroup, setDeleteGroup] = useState<AuthGroup | null>(null);

  const refresh = useCallback(() => {
    void Promise.all([authApi.listIdentities(), authApi.listGroups()])
      .then(([i, g]) => {
        setIdentities(i);
        setGroups(g);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setDenied(true);
        else toast("danger", err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const run = async (work: () => Promise<unknown>, ok: string, fail: string, done: () => void) => {
    setBusy(true);
    try {
      await work();
      toast("success", ok);
      done();
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : fail);
    } finally {
      setBusy(false);
    }
  };

  const openGroup = (existing: AuthGroup | null) => {
    setGroupDialog({ existing });
    setGroupName(existing?.name ?? "");
    setGroupDesc(existing?.description ?? "");
    setPerms(existing?.permissions ?? []);
  };

  const saveGroup = () => {
    if (!groupDialog) return;
    const existing = groupDialog.existing;
    const cleaned = perms.filter((p) => p.entity_type.trim() && p.url.trim() && p.entitlement.trim());
    void run(
      async () => {
        if (existing) await authApi.updateGroup(existing.name, { description: groupDesc.trim(), permissions: cleaned });
        else {
          await authApi.createGroup(groupName.trim(), groupDesc.trim());
          if (cleaned.length > 0) await authApi.updateGroup(groupName.trim(), { description: groupDesc.trim(), permissions: cleaned });
        }
      },
      `Group ${existing?.name ?? groupName.trim()} saved`,
      "Save failed",
      () => setGroupDialog(null),
    );
  };

  const identityColumns: Column<Identity>[] = [
    { key: "name", header: "Name", sortValue: (i) => i.name, render: (i) => <span className="font-medium">{i.name || i.identifier}</span> },
    { key: "method", header: "Method", sortValue: (i) => i.authentication_method, render: (i) => i.authentication_method },
    { key: "type", header: "Type", render: (i) => i.type },
    { key: "groups", header: "Groups", render: (i) => (i.groups && i.groups.length > 0 ? i.groups.join(", ") : "—") },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`identity-edit-${i.identifier}`} onClick={() => { setEditIdentity(i); setIdentityGroups(i.groups ?? []); }}><Pencil size={14} /> Groups</Button>
          <Button size="sm" variant="ghost" data-testid={`identity-delete-${i.identifier}`} onClick={() => setDeleteIdentity(i)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const groupColumns: Column<AuthGroup>[] = [
    { key: "name", header: "Name", sortValue: (g) => g.name, render: (g) => <span className="font-medium">{g.name}</span> },
    { key: "description", header: "Description", render: (g) => g.description || "—" },
    { key: "permissions", header: "Permissions", render: (g) => g.permissions?.length ?? 0 },
    {
      key: "members", header: "Members",
      render: (g) => Object.values(g.identities ?? {}).reduce((n, list) => n + list.length, 0),
    },
    {
      key: "actions", header: "", align: "right",
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`authgroup-edit-${g.name}`} onClick={() => openGroup(g)}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`authgroup-delete-${g.name}`} onClick={() => setDeleteGroup(g)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const patchPerm = (i: number, patch: Partial<Permission>) => setPerms((rows) => rows.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const tabs = [
    { key: "identities", label: "Identities", icon: <UserRound size={14} /> },
    { key: "groups", label: "Groups", icon: <Users size={14} /> },
  ];

  const content = denied ? (
    <div data-testid="permission-denied">
      <EmptyState title="Not available" description="Your account cannot view identities, or this server has no fine-grained authorization (OpenFGA) configured." />
    </div>
  ) : loading ? (
    <Loading dataTestId="identities-loading" label="Loading…" />
  ) : tab === "identities" ? (
    identities.length === 0 ? <EmptyState title="No identities" /> : <Table columns={identityColumns} rows={identities} rowKey={idKey} persistKey="identities" dataTestId="identities-table" />
  ) : groups.length === 0 ? (
    <EmptyState title="No groups" description="Groups bundle permissions that you can grant to identities." />
  ) : (
    <Table columns={groupColumns} rows={groups} rowKey={(g) => g.name} persistKey="auth-groups" dataTestId="authgroups-table" />
  );

  return (
    <div className="flex h-full flex-col" data-testid="identities-page">
      <PageBar
        title="Identities & groups"
        actions={tab === "groups" ? [<Button key="create" size="sm" data-testid="authgroup-create-open" onClick={() => openGroup(null)}><Plus size={14} /> Create group</Button>] : []}
      />
      <div className="min-h-0 flex-1">
        <SplitPane
          storageKey="identities"
          initial={20}
          min={12}
          left={<VerticalTabs tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} />}
          right={<div className="h-full overflow-auto">{content}</div>}
        />
      </div>

      <Dialog
        open={editIdentity !== null}
        onClose={() => setEditIdentity(null)}
        title={`Groups for ${editIdentity?.name || editIdentity?.identifier || ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditIdentity(null)}><X size={14} /> Cancel</Button>
            <Button loading={busy} data-testid="identity-save" onClick={() => editIdentity && void run(() => authApi.updateIdentityGroups(editIdentity, identityGroups), "Identity saved", "Save failed", () => setEditIdentity(null))}><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-1">
          {groups.length === 0 && <span className="text-xs text-text-tertiary">No groups exist yet.</span>}
          {groups.map((g) => (
            <Checkbox
              key={g.name}
              data-testid={`identity-group-${g.name}`}
              label={g.name}
              checked={identityGroups.includes(g.name)}
              onChange={() => setIdentityGroups((cur) => (cur.includes(g.name) ? cur.filter((x) => x !== g.name) : [...cur, g.name]))}
            />
          ))}
        </div>
      </Dialog>

      <Dialog
        open={groupDialog !== null}
        onClose={() => setGroupDialog(null)}
        wide
        title={groupDialog?.existing ? `Edit group ${groupDialog.existing.name}` : "Create group"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGroupDialog(null)}><X size={14} /> Cancel</Button>
            <Button onClick={saveGroup} loading={busy} disabled={!groupName.trim()} data-testid="authgroup-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" name="authgroup-name" data-testid="authgroup-name" value={groupName} disabled={groupDialog?.existing != null} onChange={(e) => setGroupName(e.target.value)} />
          <Input label="Description" name="authgroup-desc" data-testid="authgroup-desc" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} />
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">Permissions</h3>
            {perms.map((p, i) => (
              <div key={i} className="mb-1 grid grid-cols-[1fr_1fr_2fr_auto] gap-1">
                <Input aria-label={`Permission ${i + 1} entity type`} placeholder="entity type (e.g. project)" data-testid={`perm-type-${i}`} value={p.entity_type} onChange={(e) => patchPerm(i, { entity_type: e.target.value })} />
                <Input aria-label={`Permission ${i + 1} entitlement`} placeholder="entitlement (e.g. operator)" data-testid={`perm-entitlement-${i}`} value={p.entitlement} onChange={(e) => patchPerm(i, { entitlement: e.target.value })} />
                <Input aria-label={`Permission ${i + 1} URL`} placeholder="/1.0/projects/default" data-testid={`perm-url-${i}`} value={p.url} onChange={(e) => patchPerm(i, { url: e.target.value })} />
                <Button size="sm" variant="ghost" aria-label={`Remove permission ${i + 1}`} onClick={() => setPerms((rows) => rows.filter((_, j) => j !== i))}><X size={14} /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" data-testid="perm-add" onClick={() => setPerms((rows) => [...rows, { entity_type: "", url: "", entitlement: "" }])}><Plus size={14} /> Add permission</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteIdentity !== null}
        title="Delete identity"
        body={`Delete identity ${deleteIdentity?.name || deleteIdentity?.identifier}? It will lose access immediately.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => deleteIdentity && void run(() => authApi.deleteIdentity(deleteIdentity), "Identity deleted", "Delete failed", () => setDeleteIdentity(null))}
        onCancel={() => setDeleteIdentity(null)}
      />
      <ConfirmDialog
        open={deleteGroup !== null}
        title="Delete group"
        body={`Delete group ${deleteGroup?.name}? Members lose the permissions it grants.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => deleteGroup && void run(() => authApi.deleteGroup(deleteGroup.name), "Group deleted", "Delete failed", () => setDeleteGroup(null))}
        onCancel={() => setDeleteGroup(null)}
      />
    </div>
  );
}
