import { useRef, useState } from "react";
import { Monitor, Plus, SquareTerminal, X } from "lucide-react";
import { ColorPicker } from "./color-picker";
import { Dialog } from "./dialog";
import { Input } from "./input";

export interface TabStripTab {
  id: string;
  label: string;
  icon: "shell" | "console";
  color?: string;
}

export interface TabStripProps {
  tabs: TabStripTab[];
  activeId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
  onRename: (id: string, name: string, color: string) => void;
  onAdd: () => void;
  onAddLabel?: string;
  minTabs?: number;
  dataTestId?: string;
}

function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TabStrip({
  tabs,
  activeId,
  onSwitch,
  onClose,
  onReorder,
  onRename,
  onAdd,
  onAddLabel = "Add tab",
  minTabs = 1,
  dataTestId = "tab-strip",
}: TabStripProps) {
  const [renameTab, setRenameTab] = useState<{ id: string; name: string; color: string } | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const stripRef = useRef<HTMLDivElement>(null);
  const dragFromRef = useRef<string | null>(null);
  const dragOverRef = useRef<string | null>(null);

  const updateOverflow = () => {
    const el = stripRef.current;
    if (!el) return;
    setOverflow({
      left: el.scrollLeft > 0,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  const reorderTab = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    onReorder(fromId, toId);
  };

  const saveTabName = () => {
    if (!renameTab) return;
    onRename(renameTab.id, renameTab.name.trim(), renameTab.color);
    setRenameTab(null);
  };

  return (
    <>
      <div data-testid={dataTestId} className="flex h-9 shrink-0 items-end bg-surface-800 pl-2 pr-1.5 pt-1">
        <div className="relative flex h-full min-w-0 flex-1 items-end">
          <div
            ref={stripRef}
            data-testid={`${dataTestId}-scroll`}
            onWheel={(e) => {
              const el = e.currentTarget;
              if (el.scrollWidth > el.clientWidth) {
                el.scrollLeft += e.deltaY;
              }
            }}
            onScroll={updateOverflow}
            className="flex h-full min-w-0 flex-1 items-end gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeId;
              const canClose = tabs.length > minTabs;
              return (
                <div
                  key={tab.id}
                  data-testid={`${dataTestId}-${tab.id}`}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", tab.id);
                    e.dataTransfer.effectAllowed = "move";
                    dragFromRef.current = tab.id;
                    dragOverRef.current = null;
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    const fromId = dragFromRef.current;
                    if (fromId && fromId !== tab.id && dragOverRef.current !== tab.id) {
                      dragOverRef.current = tab.id;
                      reorderTab(fromId, tab.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (fromId) reorderTab(fromId, tab.id);
                    dragFromRef.current = null;
                    dragOverRef.current = null;
                  }}
                  onDragEnd={() => {
                    dragFromRef.current = null;
                    dragOverRef.current = null;
                  }}
                  aria-label={`Switch to ${tab.label}`}
                  onClick={() => onSwitch?.(tab.id)}
                  onDoubleClick={() => setRenameTab({ id: tab.id, name: tab.label, color: tab.color ?? "" })}
                  className={`group flex max-w-52 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3 text-xs ${
                    active
                      ? "h-full rounded-t-md text-text-primary"
                      : "my-1 h-[calc(100%-0.5rem)] self-center rounded-md text-text-secondary hover:text-text-primary"
                  }`}
                  style={{
                    backgroundColor: tab.color
                      ? tint(tab.color, active ? 0.45 : 0.2)
                      : active
                        ? "#191817"
                        : undefined,
                    ...(tab.color ? ({ "--tab-color": tint(tab.color, 0.85) } as Record<string, string>) : {}),
                  }}
                >
                  {tab.icon === "console" ? <Monitor size={13} /> : <SquareTerminal size={13} />}
                  <span className="min-w-0 truncate">{tab.label}</span>
                  {canClose && (
                    <button
                      type="button"
                      data-testid={`${dataTestId}-close-${tab.id}`}
                      aria-label={`Close ${tab.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose(tab.id);
                      }}
                      className={`ml-0.5 shrink-0 rounded-full p-0.5 transition-colors ${
                        tab.color
                          ? "text-white/30 hover:bg-[var(--tab-color)] hover:text-white"
                          : "text-text-tertiary/40 hover:bg-surface-600 hover:text-text-primary"
                      }`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            <span className="sticky right-0 z-10 ml-1 flex h-full items-end bg-surface-800 pb-1.5 pl-2 pr-0.5">
              <button
                type="button"
                data-testid={`${dataTestId}-add`}
                aria-label={onAddLabel}
                onClick={onAdd}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-tertiary hover:bg-surface-700 hover:text-text-primary"
              >
                <Plus size={14} />
              </button>
            </span>
          </div>
          <div className={`pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-surface-800 to-transparent transition-opacity ${overflow.left ? "opacity-100" : "opacity-0"}`} />
          <div className={`pointer-events-none absolute inset-y-0 right-0 z-20 mr-10 w-6 bg-gradient-to-l from-surface-800 to-transparent transition-opacity ${overflow.right ? "opacity-100" : "opacity-0"}`} />
        </div>
      </div>

      <Dialog open={renameTab !== null} onClose={() => setRenameTab(null)} title="Rename tab" footer={
        <>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-50 border border-border bg-surface-600 text-text-primary hover:bg-surface-700 h-7 px-2.5 text-xs"
            onClick={() => setRenameTab(null)}
          >
            <X size={14} /> Cancel
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed disabled:opacity-50 bg-accent-600 text-white hover:bg-accent-500 h-7 px-2.5 text-xs"
            onClick={saveTabName}
            data-testid={`${dataTestId}-rename-save`}
          >
            <Monitor size={14} /> Save
          </button>
        </>
      }>
        {renameTab && (
          <div className="space-y-3">
            <Input
              label="Name"
              name="tab-name"
              data-testid={`${dataTestId}-name`}
              value={renameTab.name}
              onChange={(e) => setRenameTab({ ...renameTab, name: e.target.value })}
            />
            <div>
              <span className="text-xs font-medium text-text-secondary">Color</span>
              <div className="mt-1.5">
                <ColorPicker
                  value={renameTab.color}
                  onChange={(c) => setRenameTab({ ...renameTab, color: c })}
                  dataTestId={`${dataTestId}-color`}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
