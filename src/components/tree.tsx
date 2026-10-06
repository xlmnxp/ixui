import { useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
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
  /** true: all subtrees open; false: everything closed; "roots": only depth-0 nodes open (default). */
  initialExpanded?: boolean | "roots";
}

/** Visible rows in DOM order, for arrow-key movement. */
function treeRows(tree: HTMLElement): HTMLElement[] {
  return [...tree.querySelectorAll<HTMLElement>("[data-tree-row]")];
}

function onTreeKeyDown(e: ReactKeyboardEvent<HTMLElement>): void {
  const target = e.target;
  if (!(target instanceof HTMLElement) || !target.hasAttribute("data-tree-row")) return;
  const rows = treeRows(e.currentTarget);
  const idx = rows.indexOf(target);
  if (e.key === "ArrowDown") rows[idx + 1]?.focus();
  else if (e.key === "ArrowUp") rows[idx - 1]?.focus();
  else if (e.key === "Home") rows[0]?.focus();
  else if (e.key === "End") rows[rows.length - 1]?.focus();
  else return;
  e.preventDefault();
}

export function Tree({ nodes, selectedId, onSelect, initialExpanded = "roots" }: TreeProps) {
  return (
    <ul role="tree" data-testid="tree" className="space-y-0.5" onKeyDown={onTreeKeyDown}>
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
  initialExpanded: boolean | "roots";
}) {
  const [expanded, setExpanded] = useState(initialExpanded === true || (initialExpanded === "roots" && depth === 0));
  const hasChildren = (node.children?.length ?? 0) > 0;

  // Clicking a row selects it and opens closed subtrees — never collapses.
  const handleClick = () => {
    onSelect?.(node.id);
    if (hasChildren) setExpanded(true);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    } else if (e.key === "ArrowRight" && hasChildren) {
      e.preventDefault();
      if (!expanded) setExpanded(true);
      else (e.currentTarget.parentElement?.querySelector(":scope > ul [data-tree-row]") as HTMLElement | null)?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (hasChildren && expanded) setExpanded(false);
      else (e.currentTarget.parentElement?.parentElement?.closest("li")?.querySelector("[data-tree-row]") as HTMLElement | null)?.focus();
    }
  };

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={selectedId === node.id}>
      <div
        data-tree-row
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onContextMenu={node.onContextMenu}
        className={`group flex cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent-500 items-center gap-1.5 px-2 py-0.5 ${selectedId === node.id ? "bg-accent-600/15 text-accent-300" : "text-text-secondary hover:bg-surface-700/60 hover:text-text-primary"}`}
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
