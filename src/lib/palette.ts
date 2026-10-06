import type { Instance, Project } from "../api/types";

export type PaletteIcon =
  | "dashboard" | "instances" | "images" | "profiles" | "networks" | "storage" | "acls" | "zones"
  | "projects" | "operations" | "activity" | "warnings" | "cluster" | "certificates" | "identities" | "settings"
  | "project" | "create" | "start" | "stop" | "restart" | "terminal";

export interface PaletteCommand {
  id: string;
  label: string;
  /** Group heading, also searchable. */
  group: string;
  /** Secondary text shown right-aligned (project, status, …). */
  hint?: string;
  /** Leading icon; instance commands use `instance` instead so the icon reflects type and status. */
  icon?: PaletteIcon;
  instance?: Pick<Instance, "status" | "type">;
  run: () => void;
}

/**
 * Subsequence match with bonuses for prefix and word-start hits.
 * Returns null when the query doesn't match, otherwise a score (higher is better).
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return null;
    if (idx === 0) score += 8;
    else if (/[\s\-_/.:]/.test(t[idx - 1] ?? "")) score += 5;
    if (idx === prevMatch + 1) score += 4;
    score -= idx - ti;
    prevMatch = idx;
    ti = idx + 1;
  }
  if (t.startsWith(q)) score += 20;
  else if (t.includes(q)) score += 10;
  return score;
}

export function filterCommands(commands: PaletteCommand[], query: string, limit = 50): PaletteCommand[] {
  if (!query.trim()) return commands.slice(0, limit);
  const scored: { cmd: PaletteCommand; score: number }[] = [];
  for (const cmd of commands) {
    const score = fuzzyScore(query, cmd.label) ?? fuzzyScore(query, `${cmd.group} ${cmd.label} ${cmd.hint ?? ""}`);
    if (score !== null) scored.push({ cmd, score });
  }
  // Array.sort is stable, so equal scores keep their declared order.
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.cmd);
}

export interface PaletteDeps {
  instances: Instance[];
  projects: Project[];
  navigate: (to: string) => void;
  setProject: (name: string) => void;
  instanceAction: (instance: Instance, action: "start" | "stop" | "restart") => void;
  openTerminal: (instance: Instance) => void;
  createInstance: () => void;
}

export const PAGES: { label: string; to: string; icon: PaletteIcon }[] = [
  { label: "Dashboard", to: "/dashboard", icon: "dashboard" },
  { label: "Instances", to: "/?tab=instances", icon: "instances" },
  { label: "Images", to: "/?tab=images", icon: "images" },
  { label: "Profiles", to: "/?tab=profiles", icon: "profiles" },
  { label: "Networks", to: "/?tab=networks", icon: "networks" },
  { label: "Storage pools", to: "/?tab=storage", icon: "storage" },
  { label: "Network ACLs", to: "/network-acls", icon: "acls" },
  { label: "Network zones", to: "/?tab=zones", icon: "zones" },
  { label: "Address sets", to: "/?tab=address-sets", icon: "zones" },
  { label: "Projects", to: "/projects", icon: "projects" },
  { label: "Operations", to: "/operations", icon: "operations" },
  { label: "Activity", to: "/activity", icon: "activity" },
  { label: "Warnings", to: "/warnings", icon: "warnings" },
  { label: "Cluster groups", to: "/cluster-groups", icon: "cluster" },
  { label: "Certificates", to: "/certificates", icon: "certificates" },
  { label: "Identities & groups", to: "/identities", icon: "identities" },
  { label: "Settings", to: "/settings", icon: "settings" },
];

export function buildCommands(d: PaletteDeps): PaletteCommand[] {
  const cmds: PaletteCommand[] = [
    { id: "action-create", group: "Actions", label: "Create instance", icon: "create", run: d.createInstance },
  ];
  for (const page of PAGES) {
    cmds.push({ id: `page-${page.to}`, group: "Go to", label: page.label, icon: page.icon, run: () => d.navigate(page.to) });
  }
  for (const p of d.projects) {
    cmds.push({ id: `project-${p.name}`, group: "Switch project", label: p.name, icon: "project", run: () => d.setProject(p.name) });
  }
  for (const i of d.instances) {
    const key = `${i.project}/${i.name}`;
    const running = i.status === "Running";
    const hint = `${i.project} · ${i.status}`;
    cmds.push({
      id: `instance-${key}`,
      group: "Instances",
      label: i.name,
      hint,
      instance: i,
      run: () => d.navigate(`/instances/${encodeURIComponent(i.name)}`),
    });
    cmds.push({ id: `terminal-${key}`, group: "Actions", label: `Open terminal: ${i.name}`, icon: "terminal", hint: i.project, run: () => d.openTerminal(i) });
    if (running) {
      cmds.push({ id: `stop-${key}`, group: "Actions", label: `Stop ${i.name}`, icon: "stop", hint: i.project, run: () => d.instanceAction(i, "stop") });
      cmds.push({ id: `restart-${key}`, group: "Actions", label: `Restart ${i.name}`, icon: "restart", hint: i.project, run: () => d.instanceAction(i, "restart") });
    } else {
      cmds.push({ id: `start-${key}`, group: "Actions", label: `Start ${i.name}`, icon: "start", hint: i.project, run: () => d.instanceAction(i, "start") });
    }
  }
  return cmds;
}
