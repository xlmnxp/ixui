import { useCallback, useEffect, useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import { infraApi } from "../api";
import type { Image } from "../api/types";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { EmptyState } from "../components/empty-state";
import { toast } from "../components/toast";
import { formatBytes } from "../lib/format";
import { registerPageBar } from "../state/page-bar";

export function ImagesPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [pullOpen, setPullOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Image | null>(null);
  const [alias, setAlias] = useState("");
  const [server, setServer] = useState("https://images.linuxcontainers.org");
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [deleteManyOpen, setDeleteManyOpen] = useState(false);
  const [deletingMany, setDeletingMany] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listImages().then(setImages).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  useEffect(
    () =>
      registerPageBar({
        title: "Images",
        actions: [
          <Button key="delete" size="sm" variant="danger" data-testid="action-delete" disabled={selectedKeys.length === 0} onClick={() => setDeleteManyOpen(true)}><Trash2 size={14} /> Delete</Button>,
          <Button key="pull" size="sm" data-testid="pull-open" onClick={() => setPullOpen(true)}><Download size={14} /> Pull image</Button>,
        ],
      }),
    [selectedKeys.length]
  );

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

  return (
    <div data-testid="images-page">
      {images.length === 0 ? (
        <EmptyState title="No images" description="Pull an image from a remote to get started." />
      ) : (
        <Table
          columns={columns}
          rows={images}
          rowKey={(i) => i.fingerprint}
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
        />
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
    </div>
  );
}
