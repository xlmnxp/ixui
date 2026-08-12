import { Link } from "react-router-dom";
import { Folder, Server, Palette, Gauge, Plus, FolderCog } from "lucide-react";
import type { ReactNode } from "react";
import type { TreeNode } from "../components/tree";
import { ALL_PROJECTS } from "../api/client";
import type { ClusterMember, Instance } from "../api/types";
import type { ProjectGroup } from "./use-tree-data";
import { InstanceIcon } from "./instance-icon";

export interface TreeParams {
  project: string;
  members: ClusterMember[];
  groups: ProjectGroup[];
  onCreate?: (targetMember?: string) => void;
  onProjectClick?: (name: string) => void;
}

const instanceNode = (idPrefix: string, i: Instance): TreeNode => ({
  id: `${idPrefix}instance-${i.name}`,
  label: (
    <span className="flex items-center gap-2">
      <InstanceIcon status={i.status} type={i.type} />
      <Link to={`/instances/${i.name}`}>{i.name}</Link>
    </span>
  ),
});

export function buildTree({ project, members, groups, onCreate, onProjectClick }: TreeParams): TreeNode[] {
  const isAll = project === ALL_PROJECTS;
  const idPrefix = isAll ? "all-" : "";

  const createAction = (testId: string, target?: string): ReactNode => (
    <button
      data-testid={testId}
      onClick={(e) => { e.stopPropagation(); onCreate?.(target); }}
      className="p-0.5 text-text-tertiary hover:bg-surface-600 hover:text-text-primary"
      aria-label="Create instance"
    >
      <Plus size={13} />
    </button>
  );

  const memberNodesFor = (group: ProjectGroup): TreeNode[] => {
    const membersWithInstances = new Set(Object.keys(group.byMember));
    const nodes: TreeNode[] = [...members]
      .filter((m) => !isAll || membersWithInstances.has(m.server_name))
      .sort((a, b) => a.server_name.localeCompare(b.server_name))
      .map((m) => ({
        id: `${idPrefix}member-${m.server_name}`,
        action: createAction(`tree-create-${m.server_name}`, m.server_name),
        label: (
          <span className="flex items-center gap-2">
            <Server size={14} className="text-text-secondary" />
            <Link to={`/members/${m.server_name}`}>{m.server_name}</Link>
            <span data-testid={`member-dot-${m.server_name}`} className={`h-2 w-2 rounded-full ${m.status === "Online" ? "bg-success" : m.status === "Evacuated" ? "bg-warning" : "bg-text-tertiary"}`} />
          </span>
        ),
        children: (group.byMember[m.server_name] ?? [])
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((i) => instanceNode(idPrefix, i)),
      }));

    if (group.unassigned.length > 0) {
      nodes.push({
        id: `${idPrefix}unassigned-${group.name}`,
        label: <span className="text-text-tertiary">unassigned</span>,
        children: [...group.unassigned].sort((a, b) => a.name.localeCompare(b.name)).map((i) => instanceNode(idPrefix, i)),
      });
    }
    return nodes;
  };

  const projectChildren: TreeNode[] = isAll
    ? groups.map((g) => ({
        id: `all-project-${g.name}`,
        label: (
          <span className="flex items-center gap-2">
            <Folder size={14} className="text-text-secondary" />
            <button
              type="button"
              data-testid={`tree-project-group-${g.name}`}
              onClick={(e) => { e.stopPropagation(); onProjectClick?.(g.name); }}
              className="text-left hover:text-text-primary"
            >
              {g.name}
            </button>
          </span>
        ),
        children: memberNodesFor(g),
      }))
    : memberNodesFor(groups[0] ?? { name: project, byMember: {}, unassigned: [] });

  return [
    {
      id: "dashboard",
      label: (
        <span className="flex items-center gap-2">
          <Gauge size={14} className="text-text-secondary" />
          <Link to="/dashboard">Dashboard</Link>
        </span>
      ),
    },
    {
      id: `project-${project}`,
      action: createAction("tree-create-project"),
      label: (
        <span className="flex items-center gap-2">
          <Folder size={14} className="text-text-secondary" />
          <Link to="/">{isAll ? "All projects" : project}</Link>
        </span>
      ),
      children: projectChildren,
    },
    {
      id: "gallery",
      label: (
        <span className="flex items-center gap-2">
          <Palette size={14} className="text-text-secondary" />
          <Link to="/gallery">Component Gallery</Link>
        </span>
      ),
    },
    {
      id: "administration",
      label: (
        <span className="flex items-center gap-2">
          <FolderCog size={14} className="text-text-secondary" />
          <span>Administration</span>
        </span>
      ),
      children: [
        {
          id: "admin-operations",
          label: (
            <span className="flex items-center gap-2">
              <Link to="/operations">Operations</Link>
            </span>
          ),
        },
        {
          id: "admin-warnings",
          label: (
            <span className="flex items-center gap-2">
              <Link to="/warnings">Warnings</Link>
            </span>
          ),
        },
        {
          id: "admin-settings",
          label: (
            <span className="flex items-center gap-2">
              <Link to="/settings">Settings</Link>
            </span>
          ),
        },
        {
          id: "admin-cluster-groups",
          label: (
            <span className="flex items-center gap-2">
              <Link to="/cluster-groups">Cluster Groups</Link>
            </span>
          ),
        },
        {
          id: "admin-certificates",
          label: (
            <span className="flex items-center gap-2">
              <Link to="/certificates">Certificates</Link>
            </span>
          ),
        },
      ],
    },
  ];
}
