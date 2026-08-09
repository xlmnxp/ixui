import { useCallback, useEffect, useState } from "react";
import { infraApi } from "../api";
import type { Project } from "../api/types";
import { projectsStore, currentProjectStore, setCurrentProject } from "../state/projects";
import { useStore } from "../state/store";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Input } from "../components/input";
import { Badge } from "../components/badge";
import { toast } from "../components/toast";

export function ProjectsPage() {
  const projects = useStore(projectsStore);
  const currentProject = useStore(currentProjectStore);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    void infraApi.listProjects().then(projectsStore.setState).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const create = async () => {
    setBusy(true);
    try {
      await infraApi.createProject({ name: name.trim() });
      toast("success", `Project ${name} created`);
      setCreateOpen(false);
      setName("");
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
      await infraApi.deleteProject(deleteTarget.name);
      toast("success", `Project ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns: Column<Project>[] = [
    {
      key: "name", header: "Name", sortValue: (p) => p.name,
      render: (p) => (
        <span className="inline-flex items-center gap-2" data-testid={p.name === currentProject ? "project-current" : undefined}>
          <span className="font-medium">{p.name}</span>
          {p.name === currentProject && <Badge tone="info">current</Badge>}
        </span>
      ),
    },
    { key: "description", header: "Description", render: (p) => p.description || "—" },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          {p.name !== currentProject && (
            <Button size="sm" variant="ghost" data-testid={`project-set-default-${p.name}`} onClick={() => { setCurrentProject(p.name); toast("info", `Switched to project ${p.name}`); }}>Set default</Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`project-delete-${p.name}`} onClick={() => setDeleteTarget(p)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Projects</h1>
        <Button size="sm" data-testid="project-create-open" onClick={() => setCreateOpen(true)}>Create project</Button>
      </div>

      <Table columns={columns} rows={projects} rowKey={(p) => p.name} emptyMessage="No projects" />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create project" footer={
        <>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} data-testid="project-create-submit">Create</Button>
        </>
      }>
        <Input label="Name" name="project-name" data-testid="project-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete project"
        body={`Delete project ${deleteTarget?.name}? All of its resources must be empty.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
