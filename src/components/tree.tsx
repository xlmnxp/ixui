import { useState } from "react";
import type { ReactNode } from "react";

export interface TreeNode {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function Tree({ nodes, selectedId, onSelect }: TreeProps) {
  return (
    <ul role="tree" data-testid="tree" className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />
      ))}
    </ul>
  );
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: TreeNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedId === node.id}>
      <div
        data-testid={`tree-${node.id}`}
        onClick={() => {
          onSelect?.(node.id);
          if (hasChildren) setExpanded((e) => !e);
        }}
        className={`flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 ${selectedId === node.id ? "bg-accent-600/15 text-accent-300" : "text-text-secondary hover:bg-surface-700/60 hover:text-text-primary"}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className={`w-3 text-xs text-text-tertiary ${hasChildren ? "" : "invisible"}`}>{expanded ? "▾" : "▸"}</span>
        <span className="truncate text-sm">{node.label}</span>
        {node.badge && <span className="ml-auto">{node.badge}</span>}
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeNodeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
