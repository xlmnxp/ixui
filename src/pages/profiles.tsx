import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { infraApi, serverApi } from "../api";
import type { Profile } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

export function ProfilesPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listProfiles().then(setProfiles).catch(() => {});
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
      await infraApi.createProfile({ name: name.trim() });
      toast("success", `Profile ${name} created`);
      setCreateOpen(false);
      setName("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = async (profileName: string) => {
    try {
      const p = await infraApi.getProfile(profileName);
      setEditing(p);
      setDescription(p.description);
      setConfig(p.config);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Load failed");
    }
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await infraApi.updateProfile(editing.name, { description, config });
      toast("success", `Profile ${editing.name} saved`);
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
      await infraApi.deleteProfile(deleteTarget.name);
      toast("success", `Profile ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const removeMany = async () => {
    setDeletingMany(true);
    try {
      await Promise.all(selectedKeys.map((name) => infraApi.deleteProfile(name)));
      toast("success", `Deleted ${selectedKeys.length} profile(s)`);
      setSelectedKeys([]);
      setDeleteManyOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeletingMany(false);
    }
  };

  const columns: Column<Profile>[] = [
    { key: "name", header: "Name", sortValue: (p) => p.name, render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "description", header: "Description", render: (p) => p.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" data-testid={`profile-edit-${p.name}`} onClick={() => openEdit(p.name)}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`profile-delete-${p.name}`} onClick={() => setDeleteTarget(p)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}><Trash2 size={14} /> Delete</Button>,
      <Button key="create" size="sm" data-testid="profile-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create profile</Button>,
    ],
    [selectedKeys, setDeleteManyOpen, setCreateOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Profiles", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div className="space-y-4" data-testid="profiles-page">
      {!registerBar && <PageBar title="Profiles" actions={barActions} />}

      {profiles.length === 0 ? (
        <EmptyState title="No profiles" />
      ) : (
        <Table columns={columns} rows={profiles} rowKey={(p) => p.name} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create profile" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="profile-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <Input label="Name" name="profile-name" data-testid="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Dialog>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={`Edit profile ${editing?.name ?? ""}`} footer={
        <>
          <Button variant="secondary" onClick={() => setEditing(null)}><X size={14} /> Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="profile-save"><Check size={14} /> Save</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Description" name="profile-description" data-testid="profile-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <KeyValueEditor values={config} onChange={setConfig} dataTestId="profile-editor" descriptions={descriptions} />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete profile"
        body={`Delete profile ${deleteTarget?.name}? Instances using it will be affected.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={deleteManyOpen}
        title="Delete profiles"
        body={`Delete ${selectedKeys.length} selected profile(s)?`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletingMany}
        onConfirm={removeMany}
        onCancel={() => setDeleteManyOpen(false)}
      />
    </div>
  );
}
