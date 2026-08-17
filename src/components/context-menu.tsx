import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface ContextMenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Items do not auto-close the menu; the owner unmounts it (or calls onClose) from here. */
  onSelect?: () => void;
  /** Submenu shown on hover; onSelect is ignored on items that have children. */
  children?: ContextMenuItem[];
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Fired on dismissal only (outside click or Escape) — not after item selection. */
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [flipSub, setFlipSub] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    // Promote to the browser top layer so the menu escapes the sidebar's
    // overflow clipping (jsdom lacks the Popover API; position:fixed keeps
    // the fallback usable). Must happen before measuring — [popover]
    // elements are display:none until shown.
    if (el?.showPopover) {
      try {
        el.showPopover();
      } catch {
        // Already shown.
      }
    }
    // Clamp into the viewport so the menu never opens cut off at the
    // bottom or right edge.
    const rect = el?.getBoundingClientRect();
    const margin = 4;
    const width = rect?.width ?? 0;
    const left = Math.max(margin, Math.min(x, window.innerWidth - width - margin));
    setPos({
      left,
      top: Math.max(margin, Math.min(y, window.innerHeight - (rect?.height ?? 0) - margin)),
    });
    // Open submenus to the left when the menu sits near the right edge
    // (176px ≈ submenu min-width incl. padding).
    setFlipSub(left + width + 176 > window.innerWidth - margin);
  }, [x, y]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      popover="manual"
      data-testid="context-menu"
      style={{ left: pos.left, top: pos.top, right: "auto", bottom: "auto" }}
      className="fixed z-50 m-0 min-w-44 overflow-visible rounded border border-border bg-surface-800 p-1 shadow-xl"
    >
      <MenuList items={items} flip={flipSub} />
    </div>
  );
}

function MenuList({ items, flip = false }: { items: ContextMenuItem[]; flip?: boolean }) {
  return (
    <ul className="text-[13px] text-text-primary">
      {items.map((item) => (
        <li key={item.id} className="group/sub relative">
          <button
            type="button"
            data-testid={`ctx-${item.id}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.children) return;
              item.onSelect?.();
            }}
            className={`flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left disabled:cursor-default disabled:text-text-tertiary ${
              item.danger ? "text-red-300 hover:bg-red-500/10 disabled:hover:bg-transparent" : "hover:bg-surface-700 disabled:hover:bg-transparent"
            }`}
          >
            {item.icon && <span className="text-text-secondary">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.children && <ChevronRight size={13} className="text-text-tertiary" />}
          </button>
          {item.children && !item.disabled && (
            <div
              className={`absolute top-0 ${flip ? "right-full" : "left-full"} hidden max-h-60 min-w-40 overflow-y-auto rounded border border-border bg-surface-800 p-1 shadow-xl group-hover/sub:block`}
            >
              <MenuList items={item.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
