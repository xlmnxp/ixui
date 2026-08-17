import { useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface TreeNode {
  id: string;
  label: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  onContextMenu?: (e: ReactMouseEvent) => void;
  children?: TreeNode[];
}

export interface TreeProps {
  nodes: TreeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  initialExpanded?: boolean;
}

export function Tree({ nodes, selectedId, onSelect, initialExpanded = false }: TreeProps) {
  return (
    <ul role="tree" data-testid="tree" className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeItem key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} initialExpanded={initialExpanded} />
      ))}
    </ul>
  );
}

function TreeNodeItem({
  node,
  selectedId,
  onSelect,
  depth,
  initialExpanded,
}: {
  node: TreeNode;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  depth: number;
  initialExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded || depth === 0);
  const hasChildren = (node.children?.length ?? 0) > 0;

  // Clicking a row selects it and opens closed subtrees — never collapses.
  const handleClick = () => {
    onSelect?.(node.id);
    if (hasChildren) setExpanded(true);
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedId === node.id}>
      <div
        onClick={handleClick}
        onContextMenu={node.onContextMenu}
        className={`group flex cursor-pointer items-center gap-1.5 px-2 py-0.5 ${selectedId === node.id ? "bg-accent-600/15 text-accent-300" : "text-text-secondary hover:bg-surface-700/60 hover:text-text-primary"}`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            data-testid={`tree-toggle-${node.id}`}
            aria-label={expanded ? `Collapse ${node.id}` : `Expand ${node.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((x) => !x);
            }}
            className="flex w-3 items-center justify-center text-text-tertiary hover:text-text-primary"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-3" aria-hidden="true" />
        )}
        <span data-testid={`tree-${node.id}`} className="truncate text-sm">
          {node.label}
        </span>
        {node.badge && <span className="ml-auto">{node.badge}</span>}
        {node.action && (
          <span
            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            {node.action}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeNodeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} initialExpanded={initialExpanded} />
          ))}
        </ul>
      )}
    </li>
  );
}
