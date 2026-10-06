import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { infraApi } from "../api";
import type { Profile } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { ReviewList, StepDialog } from "../components/step-dialog";
import type { Step } from "../components/step-dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { KeyValueEditor } from "../components/key-value-editor";
import { EmptyState } from "../components/empty-state";
import { Loading } from "../components/loading";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

interface ProfileFormState {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  config: Record<string, string>;
  setConfig: (v: Record<string, string>) => void;
  nameEditable: boolean;
}

function profileSteps(f: ProfileFormState): Step[] {
  return [
    {
      key: "basics",
      title: "Basics",
      invalid: f.name.trim() ? null : "Enter a profile name",
      content: (
        <div className="space-y-3">
          <Input label="Name" name="profile-name" data-testid="profile-name" value={f.name} disabled={!f.nameEditable} onChange={(e) => f.setName(e.target.value)} />
          <Input label="Description" name="profile-description" data-testid="profile-description" value={f.description} onChange={(e) => f.setDescription(e.target.value)} />
        </div>
      ),
    },
    {
      key: "config",
      title: "Configuration",
      content: (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Optional. Instances using this profile inherit these settings.</p>
          <KeyValueEditor values={f.config} onChange={f.setConfig} dataTestId="profile-editor" stickyHeader />
        </div>
      ),
    },
    {
      key: "review",
      title: "Review",
      content: (
        <ReviewList
          rows={[
            { label: "Name", value: f.name || "—" },
            { label: "Description", value: f.description || "—" },
            { label: "Config keys", value: Object.keys(f.config).length === 0 ? "None" : Object.entries(f.config).map(([k, v]) => `${k}=${v}`).join(", ") },
          ]}
        />
      ),
    },
  ];
}

export function ProfilesPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void infraApi.listProfiles().then(setProfiles).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const openCreate = useCallback(() => {
    setName("");
    setDescription("");
    setConfig({});
    setCreateOpen(true);
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createProfile({ name: name.trim(), description: description.trim(), config });
      toast("success", `Profile ${name.trim()} created`);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setConfig({});
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
      <Button key="create" size="sm" data-testid="profile-create-open" onClick={openCreate}><Plus size={14} /> Create profile</Button>,
    ],
    [selectedKeys, setDeleteManyOpen, openCreate]
  );

  useEffect(() => {
    registerBar?.({ title: "Profiles", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="profiles-page">
      {!registerBar && <PageBar title="Profiles" actions={barActions} />}

      {loading ? (
        <Loading dataTestId="profiles-loading" label="Loading profiles…" />
      ) : profiles.length === 0 ? (
        <EmptyState title="No profiles" />
      ) : (
        <Table persistKey="profiles" columns={columns} rows={profiles} rowKey={(p) => p.name} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} />
      )}

      <StepDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create profile"
        submitLabel="Create"
        submitIcon={<Plus size={14} />}
        busy={busy}
        wide
        onSubmit={create}
        steps={profileSteps({ name, setName, description, setDescription, config, setConfig, nameEditable: true })}
      />

      <StepDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit profile ${editing?.name ?? ""}`}
        submitLabel="Save"
        busy={busy}
        wide
        freeNavigation
        onSubmit={save}
        steps={profileSteps({ name: editing?.name ?? "", setName, description, setDescription, config, setConfig, nameEditable: false })}
      />

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
