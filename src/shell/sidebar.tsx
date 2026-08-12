import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tree } from "../components/tree";
import { ProjectDropdown } from "../components/project-dropdown";
import { buildTree } from "./tree-model";
import { useTreeData } from "./use-tree-data";
import { currentProjectStore, setCurrentProject } from "../state/projects";
import { ALL_PROJECTS } from "../api/client";
import { useStore } from "../state/store";
import { CreateInstanceWizard } from "../components/create-instance-wizard";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const project = useStore(currentProjectStore);
  const { members, groups } = useTreeData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<string | undefined>(undefined);

  const nodes = buildTree({
    project,
    members,
    groups,
    onCreate: (target) => { setWizardTarget(target); setWizardOpen(true); },
    onProjectClick: (name) => { setCurrentProject(name); navigate("/"); },
  });

  const isAll = project === ALL_PROJECTS;
  const idPrefix = isAll ? "all-" : "";

  let selectedId: string | null = null;
  const p = location.pathname;
  if (p === "/dashboard") selectedId = "dashboard";
  else if (p === "/" ) selectedId = `project-${project}`;
  else if (p.startsWith("/members/")) selectedId = `${idPrefix}member-${p.split("/")[2] ?? ""}`;
  else if (p.startsWith("/instances/")) selectedId = `${idPrefix}instance-${p.split("/")[2] ?? ""}`;
  else if (p === "/gallery") selectedId = "gallery";
  else if (p === "/operations") selectedId = "admin-operations";
  else if (p === "/warnings") selectedId = "admin-warnings";
  else if (p === "/settings") selectedId = "admin-settings";
  else if (p === "/cluster-groups") selectedId = "admin-cluster-groups";
  else if (p === "/certificates") selectedId = "admin-certificates";

  const routeFor = (id: string): string => {
    const stripped = id.startsWith("all-") ? id.slice(4) : id;
    if (stripped === "dashboard") return "/dashboard";
    if (stripped === "gallery") return "/gallery";
    if (stripped === "admin-operations") return "/operations";
    if (stripped === "admin-warnings") return "/warnings";
    if (stripped === "admin-settings") return "/settings";
    if (stripped === "admin-cluster-groups") return "/cluster-groups";
    if (stripped === "admin-certificates") return "/certificates";
    if (stripped === `project-${project}`) return "/";
    if (stripped.startsWith("project-")) return "/";
    if (stripped.startsWith("member-")) return `/members/${stripped.slice(7)}`;
    if (stripped.startsWith("instance-")) return `/instances/${stripped.slice(9)}`;
    return "/";
  };

  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar" data-testid="sidebar">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="h-3 w-3 rounded-sm bg-accent-600" data-testid="sidebar-mark" />
        <span className="text-sm font-semibold text-text-primary">Incus</span>
      </div>
      <ProjectDropdown />
      <div className="flex-1 overflow-y-auto py-2">
        <Tree nodes={nodes} selectedId={selectedId} onSelect={(id) => navigate(routeFor(id))} />
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={wizardTarget} />
    </aside>
  );
}
