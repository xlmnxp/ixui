import { Outlet } from "react-router-dom";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { TaskLog } from "./task-log";

export function Shell() {
  return (
    <div className="flex h-screen flex-col" data-testid="shell">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-surface-950">
          <Outlet />
        </main>
      </div>
      <TaskLog />
    </div>
  );
}
