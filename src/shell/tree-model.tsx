import { Link } from "react-router-dom";
import { Folder, Server, Palette, Gauge, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { TreeNode } from "../components/tree";
import type { ClusterMember, Instance } from "../api/types";
import { InstanceIcon } from "./instance-icon";

export interface TreeParams {
  project: string;
  members: ClusterMember[];
  instancesByMember: Record<string, Instance[]>;
  unassigned: Instance[];
  onCreate?: (targetMember?: string) => void;
}

const instanceNode = (i: Instance): TreeNode => ({
  id: `instance-${i.name}`,
  label: (
    <span className="flex items-center gap-2">
      <InstanceIcon status={i.status} type={i.type} />
      <Link to={`/instances/${i.name}`}>{i.name}</Link>
    </span>
  ),
});

export function buildTree({ project, members, instancesByMember, unassigned, onCreate }: TreeParams): TreeNode[] {
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

  const memberNodes: TreeNode[] = [...members]
    .sort((a, b) => a.server_name.localeCompare(b.server_name))
    .map((m) => ({
      id: `member-${m.server_name}`,
      action: createAction(`tree-create-${m.server_name}`, m.server_name),
      label: (
        <span className="flex items-center gap-2">
          <Server size={14} className="text-text-secondary" />
          <Link to={`/members/${m.server_name}`}>{m.server_name}</Link>
          <span data-testid={`member-dot-${m.server_name}`} className={`h-2 w-2 rounded-full ${m.status === "Online" ? "bg-success" : m.status === "Evacuated" ? "bg-warning" : "bg-text-tertiary"}`} />
        </span>
      ),
      children: (instancesByMember[m.server_name] ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(instanceNode),
    }));

  if (unassigned.length > 0) {
    memberNodes.push({
      id: "unassigned",
      label: <span className="text-text-tertiary">unassigned</span>,
      children: [...unassigned].sort((a, b) => a.name.localeCompare(b.name)).map(instanceNode),
    });
  }

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
          <Link to="/">{project}</Link>
        </span>
      ),
      children: memberNodes,
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
  ];
}
