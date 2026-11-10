import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tree } from "../components/tree";
import { ChevronDown, ChevronRight, Monitor, Moon, RefreshCw, Search, SquareChevronUp, SquarePlus, Sun } from "lucide-react";
import { ProjectDropdown } from "../components/project-dropdown";
import { Tooltip } from "../components/tooltip";
import { buildTree } from "./tree-model";
import { useTreeData } from "./use-tree-data";
import { currentProjectStore } from "../state/projects";
import { uiTitleStore } from "../state/ui-title";
import { useStore } from "../state/store";
import { versionLabel, versionTitle } from "../lib/version";
import { cycleTheme, themeStore } from "../state/theme";
import { createInstanceRequestStore, setPaletteOpen } from "../state/ui-actions";
import { CreateInstanceWizard } from "../components/create-instance-wizard";
import { InstanceContextMenu } from "./instance-context-menu";
import type { Instance } from "../api/types";

export function Sidebar() {
  const asideRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const project = useStore(currentProjectStore);
  const uiTitle = useStore(uiTitleStore);
  const theme = useStore(themeStore);
  const { members, instancesByMember, unassigned, reload } = useTreeData();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTarget, setWizardTarget] = useState<string | undefined>(undefined);
  const createRequest = useStore(createInstanceRequestStore);
  useEffect(() => {
    if (createRequest === 0) return;
    setWizardTarget(undefined);
    setWizardOpen(true);
  }, [createRequest]);
  const [treeEpoch, setTreeEpoch] = useState(0);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  else if (p === "/projects") selectedId = "system-projects";
  else if (p === "/settings") selectedId = "admin-settings";
  else if (p === "/cluster-groups") selectedId = "admin-cluster-groups";
  else if (p === "/certificates") selectedId = "admin-certificates";
  else if (p === "/identities") selectedId = "admin-identities";
  else if (p === "/network-acls") selectedId = "network-acls";

  const routeFor = (id: string): string => {
    if (id === "dashboard") return "/dashboard";
    if (id === "gallery") return "/gallery";
    if (id === "admin-operations") return "/operations";
    if (id === "admin-activity") return "/activity";
    if (id === "admin-warnings") return "/warnings";
    if (id === "system-projects") return "/projects";
    if (id === "admin-settings") return "/settings";
    if (id === "admin-cluster-groups") return "/cluster-groups";
    if (id === "admin-certificates") return "/certificates";
    if (id === "admin-identities") return "/identities";
    if (id === "network-acls") return "/network-acls";
    if (id.startsWith("project-")) return "/";
    if (id.startsWith("member-")) return `/members/${id.slice(7)}`;
    if (id.startsWith("instance-")) return `/instances/${id.slice(9)}`;
    return "/";
  };

  return (
    <aside ref={asideRef} className="flex h-full flex-col border-r border-border bg-sidebar" data-testid="sidebar">
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <span className="h-3 w-3 rounded-sm bg-accent-600" data-testid="sidebar-mark" />
        <span className="truncate text-sm font-semibold text-text-primary" data-testid="sidebar-title">{uiTitle}</span>
        <button
          type="button"
          data-testid="open-palette"
          aria-label="Search (Ctrl+K)"
          title="Search (Ctrl+K)"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
        >
          <Search size={14} />
        </button>
        <button
          type="button"
          data-testid="theme-toggle"
          aria-label={`Theme: ${theme} (click to change)`}
          title={`Theme: ${theme}`}
          onClick={cycleTheme}
          className="rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
        >
          {theme === "system" ? <Monitor size={14} /> : theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>
      <ProjectDropdown />
      {/* Explorer header: click the title to fold the whole section, like VS Code. */}
      <div className="flex items-center gap-1 bg-section px-1.5 py-1">
        <button
          type="button"
          data-testid="tree-section-toggle"
          aria-expanded={sectionOpen}
          aria-controls="tree-section"
          title={sectionOpen ? "Collapse explorer" : "Expand explorer"}
          onClick={() => setSectionOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary hover:bg-surface-700 hover:text-text-primary"
        >
          {sectionOpen ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
          <span className="truncate">Explorer</span>
        </button>
        <Tooltip label="New instance" side="bottom">
          <button
            type="button"
            data-testid="tree-new-instance"
            aria-label="New instance"
            onClick={() => { setWizardTarget(undefined); setWizardOpen(true); }}
            className="shrink-0 rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
          >
            <SquarePlus size={13} />
          </button>
        </Tooltip>
        <Tooltip label="Collapse all" side="bottom">
          <button
            type="button"
            data-testid="tree-collapse-all"
            aria-label="Collapse all"
            onClick={() => { setTreeExpanded(false); setTreeEpoch((e) => e + 1); }}
            className="shrink-0 rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
          >
            <SquareChevronUp size={13} />
          </button>
        </Tooltip>
        <Tooltip label={refreshing ? "Refreshing…" : "Refresh"} side="bottom">
          <button
            type="button"
            data-testid="tree-refresh"
            aria-label="Refresh"
            aria-busy={refreshing}
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void reload().finally(() => setRefreshing(false));
            }}
            className="shrink-0 rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary disabled:opacity-60"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          </button>
        </Tooltip>
      </div>
      {sectionOpen && (
        <div id="tree-section" className="min-h-0 flex-1 overflow-y-auto pb-2" data-testid="tree-section">
          <Tree key={treeEpoch} nodes={nodes} selectedId={selectedId} onSelect={(id) => navigate(routeFor(id))} initialExpanded={treeExpanded} />
        </div>
      )}
      <div className="shrink-0 border-t border-border px-3 py-1 text-[10px] text-text-tertiary" data-testid="app-version" title={versionTitle()}>
        {versionLabel()}
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
