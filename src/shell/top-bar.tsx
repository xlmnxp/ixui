import { Breadcrumbs } from "../components/breadcrumbs";
import type { Crumb } from "../components/breadcrumbs";
import { authStore } from "../auth/status";
import { useStore } from "../state/store";
import { useLocation } from "react-router-dom";

const chipByStatus = {
  unknown: { tone: "bg-warning", label: "Connecting…" },
  authenticated: { tone: "bg-success", label: "Connected" },
  unauthenticated: { tone: "bg-danger", label: "Sign in required" },
} as const;

export function TopBar() {
  const auth = useStore(authStore);
  const location = useLocation();
  const crumbs: Crumb[] = [{ label: "Incus", to: "/" }];
  const path = location.pathname;
  if (path === "/dashboard") {
    crumbs.push({ label: "Dashboard" });
  } else if (path === "/") {
    crumbs.push({ label: "Project" });
  } else if (path.startsWith("/members/")) {
    crumbs.push({ label: "Members", to: "/" }, { label: path.split("/")[2] ?? "" });
  } else if (path.startsWith("/instances")) {
    const parts = path.split("/").filter(Boolean);
    if (parts[1]) crumbs.push({ label: "Instances", to: "/?tab=instances" });
    if (parts[2]) crumbs.push({ label: parts[2]! });
    if (parts[3]) crumbs.push({ label: parts[3]! });
  } else if (path === "/gallery") {
    crumbs.push({ label: "Component Gallery" });
  } else {
    crumbs.push({ label: path.slice(1).replace("/", " ") });
  }
  const chip = chipByStatus[auth];

  return (
    <>
      <div className="h-1 bg-accent-600" data-testid="accent-band" />
      <header className="flex h-12 items-center gap-4 border-b border-border bg-surface-900 px-4" data-testid="top-bar">
        <Breadcrumbs items={crumbs} />
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-secondary" data-testid="auth-chip">
          <span className={`h-2 w-2 rounded-full ${chip.tone}`} />
          {chip.label}
        </span>
      </header>
    </>
  );
}
