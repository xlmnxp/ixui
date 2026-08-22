import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tree } from "../components/tree";
import { ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";
import { ProjectDropdown } from "../components/project-dropdown";
import { buildTree } from "./tree-model";
import { useTreeData } from "./use-tree-data";
import { currentProjectStore } from "../state/projects";
import { uiTitleStore } from "../state/ui-title";
import { useStore } from "../state/store";
import { CreateInstanceWizard } from "../components/create-instance-wizard";
import { InstanceContextMenu } from "./instance-context-menu";
import type { Instance } from "../api/types";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const project = useStore(currentProjectStore);
  const uiTitle = useStore(uiTitleStore);
  const { members, instancesByMember, unassigned } = useTreeData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<string | undefined>(undefined);
  const [treeEpoch, setTreeEpoch] = useState(0);
  // Subtrees start collapsed with only root nodes open; Expand all opens
  // everything, Collapse all closes everything including root nodes.
  const [treeExpanded, setTreeExpanded] = useState<boolean | "roots">("roots");
  const [ctxMenu, setCtxMenu] = useState<{ instance: Instance; x: number; y: number } | null>(null);

  const nodes = buildTree({
    project,
    members,
    instancesByMember,
    unassigned,
    onCreate: (target) => { setWizardTarget(target); setWizardOpen(true); },
    onInstanceMenu: (instance, e) => setCtxMenu({ instance, x: e.clientX, y: e.clientY }),
  });

  let selectedId: string | null = null;
  const p = location.pathname;
  if (p === "/dashboard") selectedId = "dashboard";
  else if (p === "/" ) selectedId = `project-${project}`;
  else if (p.startsWith("/members/")) selectedId = `member-${p.split("/")[2] ?? ""}`;
  else if (p.startsWith("/instances/")) selectedId = `instance-${p.split("/")[2] ?? ""}`;
  else if (p === "/gallery") selectedId = "gallery";
  else if (p === "/operations") selectedId = "admin-operations";
  else if (p === "/activity") selectedId = "admin-activity";
  else if (p === "/warnings") selectedId = "admin-warnings";
  else if (p === "/settings") selectedId = "admin-settings";
  else if (p === "/cluster-groups") selectedId = "admin-cluster-groups";
  else if (p === "/certificates") selectedId = "admin-certificates";
  else if (p === "/network-acls") selectedId = "network-acls";

  const routeFor = (id: string): string => {
    if (id === "dashboard") return "/dashboard";
    if (id === "gallery") return "/gallery";
    if (id === "admin-operations") return "/operations";
    if (id === "admin-activity") return "/activity";
    if (id === "admin-warnings") return "/warnings";
    if (id === "admin-settings") return "/settings";
    if (id === "admin-cluster-groups") return "/cluster-groups";
    if (id === "admin-certificates") return "/certificates";
    if (id === "network-acls") return "/network-acls";
    if (id.startsWith("project-")) return "/";
    if (id.startsWith("member-")) return `/members/${id.slice(7)}`;
    if (id.startsWith("instance-")) return `/instances/${id.slice(9)}`;
    return "/";
  };

  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar" data-testid="sidebar">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="h-3 w-3 rounded-sm bg-accent-600" data-testid="sidebar-mark" />
        <span className="truncate text-sm font-semibold text-text-primary" data-testid="sidebar-title">{uiTitle}</span>
      </div>
      <ProjectDropdown />
      <div className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          data-testid="tree-new-instance"
          onClick={() => { setWizardTarget(undefined); setWizardOpen(true); }}
          className="mr-auto flex shrink-0 items-center gap-1 whitespace-nowrap rounded border border-border bg-surface-600 px-1.5 py-0.5 text-[11px] text-text-primary hover:bg-surface-700"
        >
          <Plus size={12} /> New instance
        </button>
        <button
          type="button"
          data-testid="tree-expand-all"
          onClick={() => { setTreeExpanded(true); setTreeEpoch((e) => e + 1); }}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] text-text-tertiary hover:bg-surface-700 hover:text-text-primary"
        >
          <ChevronsUpDown size={12} /> Expand all
        </button>
        <button
          type="button"
          data-testid="tree-collapse-all"
          onClick={() => { setTreeExpanded(false); setTreeEpoch((e) => e + 1); }}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] text-text-tertiary hover:bg-surface-700 hover:text-text-primary"
        >
          <ChevronsDownUp size={12} /> Collapse all
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <Tree key={treeEpoch} nodes={nodes} selectedId={selectedId} onSelect={(id) => navigate(routeFor(id))} initialExpanded={treeExpanded} />
      </div>
      <CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={wizardTarget} />
      {ctxMenu && (
        <InstanceContextMenu
          instance={ctxMenu.instance}
          x={ctxMenu.x}
          y={ctxMenu.y}
          members={members}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </aside>
  );
}
