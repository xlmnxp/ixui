import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Tree } from "../components/tree";
import { ProjectDropdown } from "../components/project-dropdown";
import { buildTree } from "./tree-model";
import { useTreeData } from "./use-tree-data";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { CreateInstanceWizard } from "../components/create-instance-wizard";

export function Sidebar() {
  const location = useLocation();
  const project = useStore(currentProjectStore);
  const { members, instancesByMember, unassigned } = useTreeData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<string | undefined>(undefined);

  const nodes = buildTree({ project, members, instancesByMember, unassigned, onCreate: (target) => { setWizardTarget(target); setWizardOpen(true); } });

  let selectedId: string | null = null;
  const p = location.pathname;
  if (p === "/dashboard") selectedId = "dashboard";
  else if (p === "/" ) selectedId = `project-${project}`;
  else if (p.startsWith("/members/")) selectedId = `member-${p.split("/")[2] ?? ""}`;
  else if (p.startsWith("/instances/")) selectedId = `instance-${p.split("/")[2] ?? ""}`;
  else if (p === "/gallery") selectedId = "gallery";
  else if (p === "/operations") selectedId = "admin-operations";
  else if (p === "/warnings") selectedId = "admin-warnings";
  else if (p === "/settings") selectedId = "admin-settings";
  else if (p === "/cluster-groups") selectedId = "admin-cluster-groups";
  else if (p === "/certificates") selectedId = "admin-certificates";

  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar" data-testid="sidebar">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="h-3 w-3 rounded-sm bg-accent-600" data-testid="sidebar-mark" />
        <span className="text-sm font-semibold text-text-primary">Incus</span>
      </div>
      <ProjectDropdown />
      <div className="flex-1 overflow-y-auto py-2">
        <Tree nodes={nodes} selectedId={selectedId} />
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={wizardTarget} />
    </aside>
  );
}
