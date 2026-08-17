import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { TaskLog } from "./task-log";
import { SplitPane } from "../components/split-pane";

export function Shell() {
  const [taskCollapsed, setTaskCollapsed] = useState(true);

  return (
    <div className="relative h-screen overflow-hidden" data-testid="shell">
      <SplitPane
        initial={18}
        min={12}
        left={
          <div className={`h-full ${taskCollapsed ? "pb-8" : ""}`}>
            <Sidebar />
          </div>
        }
        right={
          <main className={`h-full overflow-auto bg-surface-950 ${taskCollapsed ? "pb-8" : ""}`}>
            <Outlet />
          </main>
        }
      />
      <div className="absolute inset-x-0 bottom-0 z-40">
        <TaskLog collapsed={taskCollapsed} onToggle={setTaskCollapsed} />
      </div>
    </div>
  );
}
