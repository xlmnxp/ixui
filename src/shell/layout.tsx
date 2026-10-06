import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ConnectionBanner } from "./connection-banner";
import { PaletteHost } from "./palette-host";
import { TaskLog } from "./task-log";
import { SplitPane } from "../components/split-pane";
import { useMediaQuery } from "../lib/use-media-query";
import { useFocusTrap } from "../lib/use-focus-trap";
import { uiTitleStore } from "../state/ui-title";
import { useStore } from "../state/store";

export function Shell() {
  const [taskCollapsed, setTaskCollapsed] = useState(true);
  const narrow = useMediaQuery("(max-width: 767px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const uiTitle = useStore(uiTitleStore);
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, narrow && drawerOpen);

  // Navigating (or widening the window) dismisses the drawer.
  useEffect(() => setDrawerOpen(false), [location.pathname, location.search, narrow]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const bottomPad = taskCollapsed ? "pb-8" : "";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden" data-testid="shell">
      <ConnectionBanner />
      <PaletteHost />
      {narrow ? (
        <>
          <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-2" data-testid="mobile-bar">
            <button
              type="button"
              data-testid="drawer-open"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="rounded p-1.5 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
            >
              <Menu size={16} />
            </button>
            <span className="truncate text-sm font-semibold text-text-primary">{uiTitle}</span>
          </header>
          <main className={`min-h-0 flex-1 overflow-auto bg-surface-950 ${bottomPad}`}>
            <Outlet />
          </main>
          {drawerOpen && (
            <div className="fixed inset-0 z-50 flex" data-testid="drawer">
              <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Navigation" className="relative h-full w-[85%] max-w-sm bg-sidebar shadow-xl">
                <button
                  type="button"
                  data-testid="drawer-close"
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                  className="absolute right-2 top-2 z-10 rounded p-1 text-text-secondary hover:bg-surface-700 hover:text-text-primary"
                >
                  <X size={14} />
                </button>
                <Sidebar />
              </div>
              <div className="flex-1 bg-black/60" data-testid="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
            </div>
          )}
        </>
      ) : (
        <div className="relative min-h-0 flex-1">
          <SplitPane
            storageKey="sidebar"
            initial={18}
            min={12}
            left={
              <div className={`h-full ${bottomPad}`}>
                <Sidebar />
              </div>
            }
            right={
              <main className={`h-full overflow-auto bg-surface-950 ${bottomPad}`}>
                <Outlet />
              </main>
            }
          />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-40">
        <TaskLog collapsed={taskCollapsed} onToggle={setTaskCollapsed} />
      </div>
    </div>
  );
}
