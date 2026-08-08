import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tree } from "../components/tree";
import type { TreeNode } from "../components/tree";
import { useResourceCounts } from "./use-resource-counts";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { instanceStatusTone } from "../lib/instance-status";
import { StatusDot } from "../components/status-dot";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const project = useStore(currentProjectStore);
  const { instances, counts } = useResourceCounts();

  if (collapsed) {
    return (
      <aside className="flex w-10 flex-col items-center border-r border-border bg-sidebar pt-3" data-testid="sidebar">
        <button data-testid="sidebar-toggle" onClick={() => setCollapsed(false)} className="text-text-secondary hover:text-text-primary" aria-label="Expand sidebar">▸</button>
      </aside>
    );
  }

  const projectNode: TreeNode = {
    id: `project-${project}`,
    label: project,
    children: [
      {
        id: `instances-${project}`,
        label: <Link to="/instances">Instances</Link>,
        badge: <span className="text-xs text-text-tertiary">{instances.length}</span>,
      },
      {
        id: `images-${project}`,
        label: <Link to="/images">Images</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.images}</span>,
      },
      {
        id: `profiles-${project}`,
        label: <Link to="/profiles">Profiles</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.profiles}</span>,
      },
      {
        id: `networks-${project}`,
        label: <Link to="/networks">Networks</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.networks}</span>,
      },
      {
        id: `storage-${project}`,
        label: <Link to="/storage">Storage</Link>,
        badge: <span className="text-xs text-text-tertiary">{counts.storage}</span>,
      },
    ],
  };

  const instanceNodes: TreeNode[] = instances.map((i) => ({
    id: `instance-${i.name}`,
    label: <Link to={`/instances/${i.name}`}>{i.name}</Link>,
    badge: <StatusDot tone={instanceStatusTone(i.status)} />,
  }));

  const nodes: TreeNode[] = [
    { id: "dashboard", label: <Link to="/">Dashboard</Link> },
    projectNode,
    ...instanceNodes,
    { id: "gallery", label: <Link to="/gallery">Component Gallery</Link> },
  ];

  const selectedId =
    location.pathname === "/" ? "dashboard" : location.pathname.startsWith("/gallery") ? "gallery" : null;

  return (
    <aside className="w-56 overflow-y-auto border-r border-border bg-sidebar pt-3" data-testid="sidebar">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="px-1 text-sm font-semibold text-text-primary">Incus</span>
        <button data-testid="sidebar-toggle" onClick={() => setCollapsed(true)} className="text-text-secondary hover:text-text-primary" aria-label="Collapse sidebar">◂</button>
      </div>
      <Tree nodes={nodes} selectedId={selectedId} />
    </aside>
  );
}
