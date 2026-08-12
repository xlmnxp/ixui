import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { TaskLog } from "./task-log";
import { SplitPane } from "../components/split-pane";

export function Shell() {
  return (
    <div className="flex h-screen flex-col" data-testid="shell">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SplitPane
          initial={18}
          min={12}
          left={<Sidebar />}
          right={
            <main className="h-full overflow-auto bg-surface-950">
              <Outlet />
            </main>
          }
        />
      </div>
      <TaskLog />
    </div>
  );
}
