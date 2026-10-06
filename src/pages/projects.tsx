import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { infraApi, instancesApi } from "../api";
import { ALL_PROJECTS } from "../api/client";
import type { Project } from "../api/types";
import { projectsStore, projectsLoadingStore, currentProjectStore, setCurrentProject, loadProjects } from "../state/projects";
import { useStore } from "../state/store";
import { Table } from "../components/table";
import type { Column } from "../components/table";
import { Button } from "../components/button";
import { Dialog } from "../components/dialog";
import { Input } from "../components/input";
import { Loading } from "../components/loading";
import { Badge } from "../components/badge";
import { PageBar } from "../components/page-bar";
import { ProjectEditor } from "../components/project-editor";
import { Progress } from "../components/progress";
import { toast } from "../components/toast";
import { parseProjectState, tightestResource } from "../lib/project-usage";
import type { ProjectUsage } from "../lib/project-usage";

/** Resources in the project, ignoring the default profile Incus creates with every project. */
export function projectResources(p: Project): string[] {
  return (p.used_by ?? []).filter((u) => !u.startsWith("/1.0/profiles/default"));
}
const resourceCount = (p: Project): number => projectResources(p).length;

export function ProjectsPage() {
  const projects = useStore(projectsStore);
  const projectsLoading = useStore(projectsLoadingStore);
  const currentProject = useStore(currentProjectStore);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [states, setStates] = useState<Record<string, ProjectUsage>>({});
  const [confirmName, setConfirmName] = useState("");

  const refresh = useCallback(() => {
    void loadProjects().catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  // Per-project limits and usage for the table summary and the editor.
  const projectKey = projects.map((p) => p.name).join(",");
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      projects.map(async (p) => {
        try {
          return [p.name, parseProjectState(await infraApi.projectState(p.name))] as const;
        } catch {
          return null;
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setStates(Object.fromEntries(entries.filter((e): e is [string, ProjectUsage] => e !== null)));
    });
    return () => { cancelled = true; };
  }, [projectKey]);

  const openEdit = async (project: Project) => {
    setEditing(project);
    setUsage({});
    const next: Record<string, number> = {};
    try {
      const instances = await instancesApi.list();
      next["limits.instances"] = instances.length;
      next["limits.containers"] = instances.filter((i) => i.type === "container").length;
      next["limits.virtual-machines"] = instances.filter((i) => i.type === "virtual-machine").length;
    } catch {
      // best-effort
    }
    try {
      next["limits.networks"] = (await infraApi.listNetworks()).length;
    } catch {
      // best-effort
    }
    try {
      const pools = await infraApi.listPools();
      const counts = await Promise.all(
        pools.map((pool) => infraApi.listPoolVolumes(pool.name).then((volumes) => volumes.length).catch(() => 0))
      );
      next["limits.disk"] = counts.reduce((sum, count) => sum + count, 0);
    } catch {
      // best-effort
    }
    setUsage(next);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await infraApi.deleteProject(deleteTarget.name);
      toast("success", `Project ${deleteTarget.name} deleted`);
      if (currentProject === deleteTarget.name) setCurrentProject(ALL_PROJECTS);
      setDeleteTarget(null);
      setConfirmName("");
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
      key: "resources", header: "Resources", sortValue: (p) => resourceCount(p),
      render: (p) => <span className="text-text-secondary" data-testid={`project-resources-${p.name}`}>{resourceCount(p)}</span>,
    },
    {
      key: "usage", header: "Tightest limit",
      render: (p) => {
        const t = states[p.name] ? tightestResource(states[p.name]!) : null;
        if (!t) return <span className="text-text-tertiary">—</span>;
        return (
          <span className="flex w-44 items-center gap-2" data-testid={`project-usage-${p.name}`}>
            <Progress value={t.percent} tone={t.percent >= 100 ? "danger" : "accent"} />
            <span className="shrink-0 text-xs text-text-secondary">{t.key.replace("limits.", "")} {t.percent}%</span>
          </span>
        );
      },
    },
    {
      key: "actions", header: "", align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          {p.name !== currentProject && (
            <Button size="sm" variant="ghost" data-testid={`project-set-default-${p.name}`} onClick={() => { setCurrentProject(p.name); toast("info", `Switched to project ${p.name}`); }}><Star size={14} /> Set default</Button>
          )}
          <Button size="sm" variant="ghost" data-testid={`project-edit-${p.name}`} onClick={() => openEdit(p)}><Pencil size={14} /> Edit</Button>
          <Button size="sm" variant="ghost" data-testid={`project-delete-${p.name}`} onClick={() => setDeleteTarget(p)}><Trash2 size={14} /> Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4" data-testid="projects-page">
      <PageBar
        title="Projects"
        actions={[
          <Button key="create" size="sm" data-testid="project-create-open" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create project</Button>,
        ]}
      />

      {projectsLoading && projects.length === 0 ? (
        <Loading dataTestId="projects-loading" label="Loading projects…" />
      ) : (
        <Table columns={columns} rows={projects} rowKey={(p) => p.name} emptyMessage="No projects" stickyHeaderOffset={40} />
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => { setDeleteTarget(null); setConfirmName(""); }}
        title="Delete project"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDeleteTarget(null); setConfirmName(""); }}><X size={14} /> Cancel</Button>
            <Button variant="danger" data-testid="project-delete-confirm" disabled={!deleteTarget || confirmName !== deleteTarget.name || resourceCount(deleteTarget) > 0 || deleteTarget.name === "default"} onClick={remove}><Trash2 size={14} /> Delete</Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3">
            {deleteTarget.name === "default" ? (
              <p>The <strong>default</strong> project can't be deleted.</p>
            ) : resourceCount(deleteTarget) > 0 ? (
              <>
                <p>Project <strong>{deleteTarget.name}</strong> still contains {resourceCount(deleteTarget)} resource{resourceCount(deleteTarget) === 1 ? "" : "s"}. Delete or move them first:</p>
                <ul className="max-h-40 overflow-auto rounded border border-border bg-surface-900 p-2 font-mono text-xs" data-testid="project-delete-resources">
                  {projectResources(deleteTarget).map((u) => <li key={u}>{u.replace(/^\/1\.0\//, "").replace(/\?project=.*/, "")}</li>)}
                </ul>
              </>
            ) : (
              <>
                <p>This permanently deletes project <strong>{deleteTarget.name}</strong>. Type its name to confirm.</p>
                <Input label="Project name" name="project-delete-name" data-testid="project-delete-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
              </>
            )}
          </div>
        )}
      </Dialog>

      {(editing || createOpen) && (
        <ProjectEditor
          key={editing?.name ?? "new"}
          project={editing}
          usage={usage}
          state={editing ? states[editing.name] : undefined}
          onClose={() => { setEditing(null); setCreateOpen(false); }}
          onSaved={() => { setEditing(null); setCreateOpen(false); refresh(); }}
        />
      )}
    </div>
  );
}
