import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, LogOut, Pencil, Plus, Shield, Trash2, UserCog, Users, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { authApi } from "../api";
import type { AuthGroup, AuthIdentity, AuthPermission } from "../api/auth";
import { authStore } from "../auth/status";
import { startOidcLogout } from "../auth/login";
import { useStore } from "../state/store";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { SplitPane } from "../components/split-pane";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Checkbox } from "../components/checkbox";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";

const TAB_KEYS = ["identities", "groups", "permissions"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: VerticalTabItem[] = [
  { key: "identities", label: "Identities", icon: <Users size={14} /> },
  { key: "groups", label: "Groups", icon: <UserCog size={14} /> },
  { key: "permissions", label: "Permissions", icon: <Shield size={14} /> },
];

export function AuthPage() {
  const auth = useStore(authStore);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "identities";

  const setTab = (key: string) => {
    setSearchParams({ tab: key }, { replace: false });
  };

  const [tabBar, setTabBar] = useState<BarState | null>(null);
  const [identities, setIdentities] = useState<AuthIdentity[]>([]);
  const [groups, setGroups] = useState<AuthGroup[]>([]);
  const [permissions, setPermissions] = useState<AuthPermission[]>([]);

  const refreshIdentities = useCallback(() => {
    void authApi.listIdentities().then(setIdentities).catch(() => {});
  }, []);

  const refreshGroups = useCallback(() => {
    void authApi.listGroups().then(setGroups).catch(() => {});
  }, []);

  const refreshPermissions = useCallback(() => {
    void authApi.listPermissions().then(setPermissions).catch(() => {});
  }, []);

  useEffect(() => {
    refreshIdentities();
    refreshGroups();
    refreshPermissions();
  }, [refreshIdentities, refreshGroups, refreshPermissions]);

  const barActions = [
    ...(tabBar?.actions ?? []),
    ...(auth === "authenticated"
      ? [
          <Button key="logout" size="sm" variant="ghost" data-testid="auth-logout" onClick={startOidcLogout}>
            <LogOut size={14} /> Sign out
          </Button>,
        ]
      : []),
  ];

  return (
    <div className="flex h-full flex-col" data-testid="auth-page">
      <PageBar title="Access control" actions={barActions} />
      <div className="min-h-0 flex-1">
        <SplitPane
          initial={20}
          min={12}
          left={<VerticalTabs tabs={TABS} active={tab} onChange={setTab} />}
          right={
            <div className="h-full overflow-auto">
              {tab === "identities" && <IdentitiesTab identities={identities} groups={groups} onSaved={refreshIdentities} registerBar={setTabBar} />}
              {tab === "groups" && <GroupsTab groups={groups} permissions={permissions} onSaved={refreshGroups} registerBar={setTabBar} />}
              {tab === "permissions" && <PermissionsTab permissions={permissions} registerBar={setTabBar} />}
            </div>
          }
        />
      </div>
    </div>
  );
}

interface IdentitiesTabProps {
  identities: AuthIdentity[];
  groups: AuthGroup[];
  onSaved: () => void;
  registerBar?: (bar: BarState | null) => void;
}

function IdentitiesTab({ identities, groups, onSaved, registerBar }: IdentitiesTabProps) {
  const [editing, setEditing] = useState<AuthIdentity | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const openEdit = (identity: AuthIdentity) => {
    setEditing(identity);
    setSelectedGroups(identity.groups);
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await authApi.updateIdentity(editing.type, editing.id, { groups: selectedGroups });
      toast("success", `Updated groups for ${editing.id}`);
      setEditing(null);
      onSaved();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleGroup = (name: string) => {
    setSelectedGroups((prev) => (prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name]));
  };

  useEffect(() => {
    registerBar?.({ title: "Identities", actions: [] });
    return () => registerBar?.(null);
  }, [registerBar]);

  const columns: Column<AuthIdentity>[] = [
    { key: "id", header: "ID", sortValue: (i) => i.id, render: (i) => <span className="font-medium">{i.id}</span> },
    { key: "type", header: "Type", render: (i) => i.type },
    { key: "groups", header: "Groups", render: (i) => (i.groups.length > 0 ? i.groups.join(", ") : "—") },
    { key: "name", header: "Name", render: (i) => i.name || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`identity-edit-${i.id}`} onClick={() => openEdit(i)}>
            <Pencil size={14} /> Edit groups
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="identities-tab">
      {identities.length === 0 ? (
        <EmptyState title="No identities" />
      ) : (
        <Table columns={columns} rows={identities} rowKey={(i) => `${i.type}-${i.id}`} emptyMessage="No identities" />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit groups for ${editing?.id ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
            <Button onClick={save} loading={busy} data-testid="identity-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2" data-testid="identity-group-list">
          {groups.map((g) => (
            <Checkbox
              key={g.name}
              data-testid={`identity-group-${g.name}`}
              checked={selectedGroups.includes(g.name)}
              onChange={() => toggleGroup(g.name)}
              label={g.name}
            />
          ))}
        </div>
      </Dialog>
    </div>
  );
}

interface GroupsTabProps {
  groups: AuthGroup[];
  permissions: AuthPermission[];
  onSaved: () => void;
  registerBar?: (bar: BarState | null) => void;
}

function GroupsTab({ groups, permissions, onSaved, registerBar }: GroupsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AuthGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const openCreate = useCallback(() => {
    setCreateOpen(true);
    setName("");
    setDescription("");
    setSelectedPermissions([]);
  }, []);

  const openEdit = (group: AuthGroup) => {
    setEditing(group);
    setDescription(group.description);
    setSelectedPermissions(group.permissions);
  };

  const togglePermission = (entitlement: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(entitlement) ? prev.filter((p) => p !== entitlement) : [...prev, entitlement]
    );
  };

  const create = async () => {
    setBusy(true);
    try {
      await authApi.createGroup({ name: name.trim(), description: description.trim(), permissions: selectedPermissions });
      toast("success", `Group ${name} created`);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await authApi.updateGroup(editing.name, { description: description.trim(), permissions: selectedPermissions });
      toast("success", `Group ${editing.name} saved`);
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
      await authApi.deleteGroup(deleteTarget.name);
      toast("success", `Group ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const refresh = () => {
    setCreateOpen(false);
    setEditing(null);
    onSaved();
  };

  const barActions = useMemo(
    () => [
      <Button key="create" size="sm" data-testid="group-create-open" onClick={openCreate}>
        <Plus size={14} /> Create group
      </Button>,
    ],
    [openCreate]
  );

  useEffect(() => {
    registerBar?.({ title: "Groups", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  const columns: Column<AuthGroup>[] = [
    { key: "name", header: "Name", sortValue: (g) => g.name, render: (g) => <span className="font-medium">{g.name}</span> },
    { key: "description", header: "Description", render: (g) => g.description || "—" },
    { key: "permissions", header: "Permissions", render: (g) => (g.permissions.length > 0 ? g.permissions.join(", ") : "—") },
    {
      key: "actions", header: "", align: "right",
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`group-edit-${g.name}`} onClick={() => openEdit(g)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button size="sm" variant="ghost" data-testid={`group-delete-${g.name}`} onClick={() => setDeleteTarget(g)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="groups-tab">
      {groups.length === 0 ? (
        <EmptyState title="No groups" />
      ) : (
        <Table columns={columns} rows={groups} rowKey={(g) => g.name} emptyMessage="No groups" />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create group"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={create} loading={busy} data-testid="group-create-submit"><Plus size={14} /> Create</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" name="group-name" data-testid="group-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" name="group-description" data-testid="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <PermissionPicker permissions={permissions} selected={selectedPermissions} onToggle={togglePermission} />
        </div>
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit group ${editing?.name ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
            <Button onClick={save} loading={busy} data-testid="group-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Description" name="group-description" data-testid="group-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <PermissionPicker permissions={permissions} selected={selectedPermissions} onToggle={togglePermission} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete group"
        body={`Delete group ${deleteTarget?.name}? Identities in it will lose its permissions.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function PermissionPicker({ permissions, selected, onToggle }: { permissions: AuthPermission[]; selected: string[]; onToggle: (entitlement: string) => void }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-text-secondary">Permissions</span>
      <div className="grid grid-cols-2 gap-2" data-testid="permission-list">
        {permissions.map((p) => (
          <Checkbox
            key={p.entitlement}
            data-testid={`permission-${p.entitlement}`}
            checked={selected.includes(p.entitlement)}
            onChange={() => onToggle(p.entitlement)}
            label={p.entitlement}
          />
        ))}
      </div>
    </div>
  );
}

function PermissionsTab({ permissions, registerBar }: { permissions: AuthPermission[]; registerBar?: (bar: BarState | null) => void }) {
  useEffect(() => {
    registerBar?.({ title: "Permissions", actions: [] });
    return () => registerBar?.(null);
  }, [registerBar]);

  const columns: Column<AuthPermission>[] = [
    { key: "entitlement", header: "Entitlement", sortValue: (p) => p.entitlement, render: (p) => <span className="font-medium">{p.entitlement}</span> },
    { key: "description", header: "Description", render: (p) => p.description || "—" },
  ];

  return (
    <div className="space-y-4" data-testid="permissions-tab">
      {permissions.length === 0 ? (
        <EmptyState title="No permissions" />
      ) : (
        <Table columns={columns} rows={permissions} rowKey={(p) => p.entitlement} emptyMessage="No permissions" />
      )}
    </div>
  );
}
