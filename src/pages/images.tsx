import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, List, Plus, Trash2, X } from "lucide-react";
import { infraApi } from "../api";
import type { Image, ImageAlias } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";
import { formatBytes } from "../lib/format";

export function ImagesPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [images, setImages] = useState<Image[]>([]);
  const [pullOpen, setPullOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Image | null>(null);
  const [alias, setAlias] = useState("");
  const [server, setServer] = useState("https://images.linuxcontainers.org");
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);
  const [aliasesOpen, setAliasesOpen] = useState(false);
  const [aliases, setAliases] = useState<ImageAlias[]>([]);
  const [aliasCreateOpen, setAliasCreateOpen] = useState(false);
  const [aliasName, setAliasName] = useState("");
  const [aliasTarget, setAliasTarget] = useState("");
  const [aliasBusy, setAliasBusy] = useState(false);
  const [aliasDelete, setAliasDelete] = useState<ImageAlias | null>(null);

  const refresh = useCallback(() => {
    void infraApi.listImages().then(setImages).catch(() => {});
  }, []);

  const refreshAliases = useCallback(() => {
    void infraApi.listAliases().then(setAliases).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (aliasesOpen) refreshAliases();
  }, [aliasesOpen, refreshAliases]);

  const pull = async () => {
    setBusy(true);
    try {
      await infraApi.pullImage({ alias: alias.trim(), server: server.trim() });
      toast("success", `Pulling ${alias.trim()}`);
      setPullOpen(false);
      setAlias("");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteImage(deleteTarget.fingerprint);
      toast("success", "Image deleted");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const removeMany = async () => {
    setDeletingMany(true);
    try {
      await Promise.all(selectedKeys.map((fp) => infraApi.deleteImage(fp)));
      toast("success", `Deleted ${selectedKeys.length} image(s)`);
      setSelectedKeys([]);
      setDeleteManyOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
      setDeletingMany(false);
    }
  };

  const createAlias = async () => {
    setAliasBusy(true);
    try {
      await infraApi.createAlias({ name: aliasName.trim(), target: aliasTarget.trim() });
      toast("success", `Alias ${aliasName.trim()} created`);
      setAliasCreateOpen(false);
      setAliasName("");
      setAliasTarget("");
      refreshAliases();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setAliasBusy(false);
    }
  };

  const removeAlias = async () => {
    if (!aliasDelete) return;
    try {
      await infraApi.deleteAlias(aliasDelete.name);
      toast("success", "Alias deleted");
      setAliasDelete(null);
      refreshAliases();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const aliasValid = aliasName.trim() !== "" && aliasTarget.trim() !== "";

  const columns: Column<Image>[] = [
    { key: "name", header: "Description", sortValue: (i) => i.description, render: (i) => i.description || i.filename },
    { key: "fingerprint", header: "Fingerprint", render: (i) => <span className="font-mono text-xs">{i.fingerprint.slice(0, 12)}</span> },
    { key: "type", header: "Type", render: (i) => (i.type === "container" ? "Container" : "VM") },
    { key: "size", header: "Size", align: "right", sortValue: (i) => i.size, render: (i) => formatBytes(i.size) },
    { key: "created", header: "Created", render: (i) => new Date(i.created_at).toLocaleDateString() },
    {
      key: "actions", header: "", align: "right",
      render: (i) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" data-testid={`image-delete-${i.fingerprint}`} onClick={() => setDeleteTarget(i)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const aliasColumns: Column<ImageAlias>[] = [
    { key: "name", header: "Name", sortValue: (a) => a.name, render: (a) => <span className="font-mono text-xs">{a.name}</span> },
    { key: "target", header: "Target", render: (a) => <span className="font-mono text-xs text-text-secondary">{a.target}</span> },
    { key: "description", header: "Description", render: (a) => a.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (a) => (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" data-testid={`alias-delete-${a.name}`} onClick={() => setAliasDelete(a)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  const barActions = useMemo(
    () => [
      <Button key="aliases" size="sm" variant="secondary" data-testid="aliases-open" onClick={() => setAliasesOpen((o) => !o)}><List size={14} /> Aliases</Button>,
      <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}><Trash2 size={14} /> Delete</Button>,
      <Button key="pull" size="sm" data-testid="pull-open" onClick={() => setPullOpen(true)}><Download size={14} /> Pull image</Button>,
    ],
    [selectedKeys, aliasesOpen, setDeleteManyOpen, setPullOpen, setAliasesOpen]
  );

  useEffect(() => {
    registerBar?.({ title: "Images", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="images-page">
      {!registerBar && <PageBar title="Images" actions={barActions} />}

      {images.length === 0 ? (
        <EmptyState title="No images" description="Pull an image from a remote to get started." />
      ) : (
        <Table columns={columns} rows={images} rowKey={(i) => i.fingerprint} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} stickyHeaderOffset={40} />
      )}

      {aliasesOpen && (
        <div className="space-y-2" data-testid="aliases-section">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Aliases</h3>
            <Button size="sm" data-testid="alias-create-open" onClick={() => setAliasCreateOpen(true)}><Plus size={14} /> New alias</Button>
          </div>
          <Table columns={aliasColumns} rows={aliases} rowKey={(a) => a.name} dataTestId="aliases-table" emptyMessage="No aliases" />
        </div>
      )}

      <Dialog open={pullOpen} onClose={() => setPullOpen(false)} title="Pull image" footer={
        <>
          <Button variant="secondary" onClick={() => setPullOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={pull} loading={busy} data-testid="pull-submit"><Download size={14} /> Pull</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Alias" name="pull-alias" data-testid="pull-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ubuntu/24.04" />
          <Input label="Server" name="pull-server" data-testid="pull-server" value={server} onChange={(e) => setServer(e.target.value)} />
          <Select label="Type" name="pull-type" defaultValue="container">
            <option value="container">Container</option>
            <option value="virtual-machine">Virtual machine</option>
          </Select>
        </div>
      </Dialog>

      <Dialog open={aliasCreateOpen} onClose={() => setAliasCreateOpen(false)} title="Create alias" footer={
        <>
          <Button variant="secondary" onClick={() => setAliasCreateOpen(false)}><X size={14} /> Cancel</Button>
          <Button onClick={createAlias} loading={aliasBusy} disabled={!aliasValid} data-testid="alias-create-submit"><Plus size={14} /> Create</Button>
        </>
      }>
        <div className="space-y-3">
          <Input label="Name" name="alias-name" data-testid="alias-name" value={aliasName} onChange={(e) => setAliasName(e.target.value)} placeholder="ubuntu/24.04" />
          <Input label="Target" name="alias-target" data-testid="alias-target" value={aliasTarget} onChange={(e) => setAliasTarget(e.target.value)} placeholder="ubuntu-24.04-default-amd64" />
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete image"
        body={`Delete image ${deleteTarget?.description || deleteTarget?.fingerprint.slice(0, 12)}? This does not affect existing instances.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={deleteManyOpen}
        title="Delete images"
        body={`Delete ${selectedKeys.length} selected image(s)?`}
        confirmLabel="Delete"
        tone="danger"
        loading={deletingMany}
        onConfirm={removeMany}
        onCancel={() => setDeleteManyOpen(false)}
      />
      <ConfirmDialog
        open={aliasDelete !== null}
        title="Delete alias"
        body={`Delete alias ${aliasDelete?.name}?`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={removeAlias}
        onCancel={() => setAliasDelete(null)}
      />
    </div>
  );
}
