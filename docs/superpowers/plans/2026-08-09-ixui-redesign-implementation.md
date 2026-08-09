# ixui Redesign Implementation Plan (Proxmox Shell, Cluster Tree, Floating Wizard)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle ixui into a Proxmox/ESXi-style admin shell with a cluster-aware instance tree (members → instances with type icon + corner status dot), a sidebar project selector, vertical side tabs for resources and instance detail, the genuine Incus orange palette, and a floating 4-stage create-instance wizard.

**Architecture:** Incremental restructure. New primitives first (Window, VerticalTabs, ProjectDropdown, tree model, instance icon), then the sidebar rewrite (cluster members from `/1.0/cluster/members`, instances grouped by `location`, project dropdown, fixed left panel), then routing (project overview at `/` with `?tab=` vertical tabs, dashboard at `/dashboard`, member views at `/members/:name`), then detail side tabs, palette/density pass, and finally the floating wizard replacing the `/instances/new` page. lucide-react is the only new runtime dependency.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 tokens, react-router-dom 7, lucide-react (new), Vitest + RTL.

## Global Constraints

- Runtime dependencies are ONLY: react, react-dom, react-router-dom, xterm, @xterm/addon-fit, lucide-react. No other UI libraries.
- TypeScript strict. No `any`.
- All interactive elements get a data-testid.
- Every commit must pass: `npx vitest run`, `npm run typecheck`, `npm run lint`.
- Tests never hit the network.
- New palette tokens (exact values from the official Incus logo `#dd4814`): accent-700 `#B03910`, accent-600 `#DD4814`, accent-500 `#E85C26`, accent-400 `#F0763F`, accent-300 `#F59B70`; surface-950 `#191817`, surface-900 `#1F1E1D`, surface-800 `#262524`, surface-700 `#2E2D2B`, surface-600 `#383634`, surface-500 `#44413E`, border `#3A3835`; text-primary `#EDEBE8`, text-secondary `#B5B1AB`, text-tertiary `#7E7A74`. Token NAMES are unchanged.
- Routes: `/` project overview (`?tab=instances|images|profiles|networks|storage`), `/dashboard`, `/members/:name`, `/instances/:name/:tab?`, `/gallery`; old `/instances` etc. redirect to `/?tab=…`. The `/instances/new` route is removed.
- Instance tree: project root → cluster member nodes → instances (type icon + corner status dot + name). No infra branches in the sidebar.

---

### Task 1: lucide-react + Incus Orange Palette + Density

**Files:**
- Modify: `package.json` (add lucide-react), `src/styles/theme.css` (token values), `src/components/table.tsx` (cell padding), `src/components/tree.tsx` (row padding)

**Interfaces:**
- Consumes: nothing new
- Produces: `lucide-react` installed; warm-dark + orange token values live; denser Table/Tree

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`
Expected: lucide-react added to dependencies.

- [ ] **Step 2: Swap the palette values**

In `src/styles/theme.css`, replace the `@theme` block values exactly (keep all token NAMES):

```css
@theme {
  --font-sans: ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;

  /* Incus brand accent — anchored on the official logo color #dd4814 */
  --color-accent-300: #f59b70;
  --color-accent-400: #f0763f;
  --color-accent-500: #e85c26;
  --color-accent-600: #dd4814;
  --color-accent-700: #b03910;

  /* Warm dark surfaces */
  --color-surface-950: #191817;
  --color-surface-900: #1f1e1d;
  --color-surface-800: #262524;
  --color-surface-700: #2e2d2b;
  --color-surface-600: #383634;
  --color-surface-500: #44413e;
  --color-sidebar: #1f1e1d;

  /* Text + borders */
  --color-text-primary: #edebe8;
  --color-text-secondary: #b5b1ab;
  --color-text-tertiary: #7e7a74;
  --color-border: #3a3835;

  /* Semantic (unchanged) */
  --color-success: #3fb950;
  --color-warning: #d29922;
  --color-danger: #f85149;
}
```

Keep the `@keyframes indeterminate` block and body styles unchanged.

- [ ] **Step 3: Densify Table**

In `src/components/table.tsx`, change cell padding classes:
- `<th className={`px-3 py-2 …`}>` → `px-2.5 py-1.5`
- `<td className={`px-3 py-2 …`}>` (both the checkbox cell and the column cells) → `px-2.5 py-1.5`
- Add `text-[13px]` to the `<table>` className (keep `text-sm` off)

- [ ] **Step 4: Densify Tree rows**

In `src/components/tree.tsx`, `TreeNodeItem` row div: `px-2 py-1` → `px-2 py-0.5` (both the paddingLeft style line and the className).

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass (tests assert testids/text, not paddings or colors).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/styles/theme.css src/components/table.tsx src/components/tree.tsx
git commit -m "feat: incus orange palette, lucide-react, denser table and tree"
```

---

### Task 2: Cluster API (types + endpoint)

**Files:**
- Modify: `src/api/types.ts` (add `ClusterMember`, `Instance.location`)
- Create: `src/api/cluster.ts`, modify `src/api/index.ts` (clusterApi singleton)
- Modify: `src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `ApiClient`
- Produces:
  - `ClusterMember = { server_name: string; url: string; database: boolean; status: string; message: string; architecture: string }` in `src/api/types.ts`
  - `Instance` gains `location?: string` (optional — test fixtures don't set it)
  - `ClusterApi.listMembers(): Promise<ClusterMember[]>` in `src/api/cluster.ts` — calls `client.get<ClusterMember[]>("/cluster/members?recursion=1")` (deliberately NOT project-scoped; cluster members are global)
  - `export const clusterApi = new ClusterApi(api)` in `src/api/index.ts`

- [ ] **Step 1: Add the type and field**

`src/api/types.ts` — append:
```ts
export interface ClusterMember {
  server_name: string;
  url: string;
  database: boolean;
  status: string;
  message: string;
  architecture: string;
}
```
And in `Instance`, add after `project: string;`:
```ts
  location?: string;
```

- [ ] **Step 2: Write the failing test**

`src/api/endpoints.test.ts` — add to the existing suite:
```ts
it("cluster members list is not project-scoped", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [{ server_name: "incus-1", url: "https://x", database: true, status: "Online", message: "", architecture: "x86_64" }]));
  vi.stubGlobal("fetch", fetchMock);
  await clusterApi.listMembers();
  expect(fetchMock).toHaveBeenCalledWith("/1.0/cluster/members?recursion=1", expect.anything());
});
```
Add `clusterApi` to the import at the top of the file.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/api/endpoints.test.ts`
Expected: FAIL — module `cluster` not found.

- [ ] **Step 4: Implement**

`src/api/cluster.ts`:
```ts
import type { ApiClient } from "./client";
import type { ClusterMember } from "./types";

export class ClusterApi {
  constructor(private client: ApiClient) {}

  listMembers(): Promise<ClusterMember[]> {
    return this.client.get<ClusterMember[]>("/cluster/members?recursion=1");
  }
}
```

`src/api/index.ts` — add:
```ts
import { ClusterApi } from "./cluster";
export const clusterApi = new ClusterApi(api);
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/api
git commit -m "feat: add cluster members api"
```

---

### Task 3: Window Primitive

**Files:**
- Create: `src/components/window.tsx`, `src/components/window.test.tsx`

**Interfaces:**
- Consumes: lucide-react (`X` icon)
- Produces: `Window({ open, onClose, title, subtitle?, children, footer? })` — portal to body; centered 640px panel; draggable via header (`data-testid="window-drag"`, clamped to viewport); backdrop click + Escape close; `data-testid="window"`, `data-testid="window-close"`, `data-testid="window-backdrop"`

- [ ] **Step 1: Write the failing test**

`src/components/window.test.tsx`:
```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Window } from "./window";

describe("Window", () => {
  it("renders nothing when closed", () => {
    render(<Window open={false} onClose={() => {}} title="T">x</Window>);
    expect(screen.queryByTestId("window")).not.toBeInTheDocument();
  });

  it("renders title, children, and footer", () => {
    render(
      <Window open onClose={() => {}} title="Create instance" footer={<button>Go</button>}>
        <p>body</p>
      </Window>
    );
    expect(screen.getByRole("dialog", { name: "Create instance" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<Window open onClose={onClose} title="T">x</Window>);
    fireEvent.click(screen.getByTestId("window-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Window open onClose={onClose} title="T">x</Window>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drags the window via the header", () => {
    render(<Window open onClose={() => {}} title="T">x</Window>);
    const header = screen.getByTestId("window-drag");
    const panel = screen.getByTestId("window");
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 120 });
    fireEvent.pointerUp(window);
    expect(panel).toHaveStyle({ transform: "translate(50px, 20px)" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/window.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/components/window.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface WindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function Window({ open, onClose, title, subtitle, children, footer }: WindowProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const width = panelRef.current?.offsetWidth ?? 640;
      const height = panelRef.current?.offsetHeight ?? 520;
      const maxX = Math.max(0, window.innerWidth - width);
      const maxY = Math.max(0, window.innerHeight - height);
      setPos({
        x: Math.min(maxX, Math.max(0, d.origX + e.clientX - d.startX)),
        y: Math.min(maxY, Math.max(0, d.origY + e.clientY - d.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="window-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="window"
        className="w-[640px] overflow-hidden rounded-lg border border-border bg-surface-800 shadow-2xl"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          data-testid="window-drag"
          onPointerDown={(e) => {
            dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
          }}
          className="flex cursor-move items-center justify-between border-b border-border bg-surface-700 px-4 py-2.5 select-none"
        >
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
          </div>
          <button data-testid="window-close" onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[420px] overflow-auto p-4 text-sm text-text-secondary">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-900 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/components/window.test.tsx && npm run typecheck && npm run lint`
Expected: 5 tests pass, gates clean. (jsdom reports `pointermove` on `window` via `fireEvent.pointerMove(window, …)` — if the transform assertion needs the pointer events on the panel instead, use `fireEvent.pointerMove(panel, …)`.)

- [ ] **Step 5: Commit**

```bash
git add src/components/window.tsx src/components/window.test.tsx
git commit -m "feat: add floating window primitive"
```

---

### Task 4: VerticalTabs Primitive

**Files:**
- Create: `src/components/vertical-tabs.tsx`, `src/components/vertical-tabs.test.tsx`
- Modify: `src/components/tabs.tsx` — add optional `icon?: ReactNode` to `TabItem` (Tabs ignores it)

**Interfaces:**
- Consumes: nothing new
- Produces: `VerticalTabItem = { key: string; label: ReactNode; icon?: ReactNode }`; `VerticalTabs({ tabs, active, onChange })` — vertical strip ~176px (`w-44`), `role="tablist"` with `aria-orientation="vertical"`, each tab `data-testid="vtab-<key>"`, active = `border-l-2 border-accent-600 bg-accent-600/10 text-text-primary`, inactive = `border-transparent text-text-secondary hover:bg-surface-700`; container `data-testid="vertical-tabs"`
- `TabItem` in `tabs.tsx` gains optional `icon?: ReactNode`

- [ ] **Step 1: Extend TabItem**

`src/components/tabs.tsx`:
```tsx
export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}
```
(No other change to Tabs.)

- [ ] **Step 2: Write the failing test**

`src/components/vertical-tabs.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerticalTabs } from "./vertical-tabs";

describe("VerticalTabs", () => {
  const tabs = [
    { key: "instances", label: "Instances" },
    { key: "images", label: "Images" },
  ];

  it("renders tabs with active state", () => {
    render(<VerticalTabs tabs={tabs} active="images" onChange={() => {}} />);
    expect(screen.getByTestId("vertical-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("vtab-instances")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("vtab-images")).toHaveAttribute("aria-selected", "true");
  });

  it("switches on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VerticalTabs tabs={tabs} active="instances" onChange={onChange} />);
    await user.click(screen.getByTestId("vtab-images"));
    expect(onChange).toHaveBeenCalledWith("images");
  });

  it("renders icons when provided", () => {
    render(<VerticalTabs tabs={[{ key: "a", label: "A", icon: <span data-testid="icon-a" /> }]} active="a" onChange={() => {}} />);
    expect(screen.getByTestId("icon-a")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/components/vertical-tabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`src/components/vertical-tabs.tsx`:
```tsx
import type { ReactNode } from "react";

export interface VerticalTabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface VerticalTabsProps {
  tabs: VerticalTabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function VerticalTabs({ tabs, active, onChange }: VerticalTabsProps) {
  return (
    <div role="tablist" aria-orientation="vertical" data-testid="vertical-tabs" className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-surface-900 p-1.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          data-testid={`vtab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 rounded border-l-2 px-2.5 py-1.5 text-left text-[13px] ${active === t.key ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-transparent text-text-secondary hover:bg-surface-700 hover:text-text-primary"}`}
        >
          {t.icon}
          <span className="truncate">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run src/components/vertical-tabs.test.tsx && npm run typecheck && npm run lint`
Expected: 3 tests pass, gates clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/vertical-tabs.tsx src/components/vertical-tabs.test.tsx src/components/tabs.tsx
git commit -m "feat: add vertical tabs primitive"
```

---

### Task 5: ProjectDropdown Primitive

**Files:**
- Create: `src/components/project-dropdown.tsx`, `src/components/project-dropdown.test.tsx`

**Interfaces:**
- Consumes: `projectsStore`, `currentProjectStore`, `setCurrentProject` (from `../state/projects`), `useStore`
- Produces: `ProjectDropdown()` — button `data-testid="project-selector"` showing current project + `ChevronsUpDown` icon; popover `data-testid="project-menu"` listing `projectsStore` entries, current one checked (`data-testid="project-option-<name>"`), click → `setCurrentProject(name)`; closes on outside click + Escape; popover anchored below the button

- [ ] **Step 1: Write the failing test**

`src/components/project-dropdown.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectDropdown } from "./project-dropdown";
import { projectsStore, currentProjectStore } from "../state/projects";

describe("ProjectDropdown", () => {
  beforeEach(() => {
    projectsStore.setState([
      { name: "default", description: "", config: {} },
      { name: "prod", description: "", config: {} },
    ]);
    currentProjectStore.setState("default");
  });

  it("shows the current project", () => {
    render(<ProjectDropdown />);
    expect(screen.getByTestId("project-selector")).toHaveTextContent("default");
  });

  it("opens the menu and switches project", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));
    await user.click(screen.getByTestId("project-option-prod"));
    expect(currentProjectStore.getState()).toBe("prod");
    expect(screen.getByTestId("project-selector")).toHaveTextContent("prod");
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(<ProjectDropdown />);
    await user.click(screen.getByTestId("project-selector"));
    expect(screen.getByTestId("project-menu")).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByTestId("project-menu")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/project-dropdown.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/components/project-dropdown.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { projectsStore, currentProjectStore, setCurrentProject } from "../state/projects";
import { useStore } from "../state/store";

export function ProjectDropdown() {
  const projects = useStore(projectsStore);
  const current = useStore(currentProjectStore);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative px-2 pb-1">
      <button
        data-testid="project-selector"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between rounded border border-border bg-surface-700 px-2.5 text-[13px] text-text-primary hover:bg-surface-600"
      >
        <span className="truncate">{current}</span>
        <ChevronsUpDown size={14} className="text-text-tertiary" />
      </button>
      {open && (
        <div data-testid="project-menu" className="absolute left-2 right-2 z-40 mt-1 overflow-hidden rounded border border-border bg-surface-800 shadow-xl">
          {projects.map((p) => (
            <button
              key={p.name}
              data-testid={`project-option-${p.name}`}
              onClick={() => {
                setCurrentProject(p.name);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-700 ${p.name === current ? "text-accent-400" : "text-text-primary"}`}
            >
              <span className="truncate">{p.name}</span>
              {p.name === current && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/components/project-dropdown.test.tsx && npm run typecheck && npm run lint`
Expected: 3 tests pass, gates clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/project-dropdown.tsx src/components/project-dropdown.test.tsx
git commit -m "feat: add project dropdown"
```

---

### Task 6: Instance Icon + Tree Model Builder

**Files:**
- Create: `src/shell/instance-icon.tsx`, `src/shell/instance-icon.test.tsx`, `src/shell/tree-model.ts`, `src/shell/tree-model.test.ts`

**Interfaces:**
- Consumes: `TreeNode` (from `src/components/tree.tsx`), `ClusterMember`, `Instance`, lucide icons
- Produces:
  - `instanceDotClass(status: string): string` — `Running`/`Started` → `bg-success`, `Stopped` → `bg-text-tertiary`, `Frozen`/`Paused` → `bg-blue-400`, `Error` → `bg-danger`, default `bg-text-tertiary`
  - `InstanceIcon({ status, type }: { status: string; type: "container" | "virtual-machine" })` — `Box` icon for containers, `Monitor` for VMs, 15px, `text-text-secondary`, with an absolutely positioned 8px corner dot (top-right) using `instanceDotClass`; `data-testid="instance-icon"`
  - `buildTree({ project, members, instancesByMember, unassigned }): TreeNode[]` in `src/shell/tree-model.ts`:
    - `{ id: "dashboard", label: <Link to="/dashboard">Dashboard</Link> }`
    - `{ id: \`project-${project}\`, label: <Link to="/">…project…</Link>, children: memberNodes }` where each member node = `{ id: \`member-${name}\`, label: member name with Server icon + online/offline dot, children: instances sorted by name }`
    - instances sorted alphabetically; unassigned bucket node `{ id: "unassigned", label: "unassigned", children: […] }` appended when non-empty
    - `{ id: "gallery", label: <Link to="/gallery">Component Gallery</Link> }`
  - Instance child labels: `<span className="flex items-center gap-2"><InstanceIcon status={i.status} type={i.type} /><span>{i.name}</span></span>`

- [ ] **Step 1: Write the failing tests**

`src/shell/instance-icon.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { InstanceIcon, instanceDotClass } from "./instance-icon";

describe("instanceDotClass", () => {
  it("maps running states to success", () => {
    expect(instanceDotClass("Running")).toBe("bg-success");
    expect(instanceDotClass("Started")).toBe("bg-success");
  });
  it("maps stopped to neutral and error to danger", () => {
    expect(instanceDotClass("Stopped")).toBe("bg-text-tertiary");
    expect(instanceDotClass("Error")).toBe("bg-danger");
  });
});

describe("InstanceIcon", () => {
  it("renders a container icon with a status dot", () => {
    render(<InstanceIcon status="Running" type="container" />);
    expect(screen.getByTestId("instance-icon")).toHaveTextContent("");
    expect(screen.getByTestId("instance-icon").querySelector(".bg-success")).toBeInTheDocument();
  });
});
```

`src/shell/tree-model.test.ts`:
```ts
import { buildTree } from "./tree-model";

const member = (name: string) => ({ server_name: name, url: "", database: true, status: "Online", message: "", architecture: "x86_64" });
const instance = (name: string, location?: string) => ({
  name, status: "Running", type: "container", description: "", created_at: "t", last_used_at: "t",
  config: {}, devices: {}, profiles: [], project: "default", ephemeral: false, location,
});

describe("buildTree", () => {
  it("nests instances under their member", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-2"), member("incus-1")],
      instancesByMember: { "incus-1": [instance("web1", "incus-1")], "incus-2": [] },
      unassigned: [],
    });
    expect(tree[1]?.id).toBe("project-default");
    const memberChildren = tree[1]?.children ?? [];
    expect(memberChildren.map((m) => m.id)).toEqual(["member-incus-1", "member-incus-2"]);
    expect(memberChildren[0]?.children?.map((i) => i.id)).toEqual(["instance-web1"]);
  });

  it("sorts instances alphabetically", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1")],
      instancesByMember: { "incus-1": [instance("z1", "incus-1"), instance("a1", "incus-1")] },
      unassigned: [],
    });
    const children = tree[1]?.children?.[0]?.children ?? [];
    expect(children.map((i) => i.id)).toEqual(["instance-a1", "instance-z1"]);
  });

  it("adds an unassigned bucket", () => {
    const tree = buildTree({ project: "default", members: [member("incus-1")], instancesByMember: {}, unassigned: [instance("drift")] });
    expect(tree[1]?.children?.some((m) => m.id === "unassigned")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/shell/instance-icon.test.tsx src/shell/tree-model.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`src/shell/instance-icon.tsx`:
```tsx
import { Box, Monitor } from "lucide-react";

const DOT: Record<string, string> = {
  Running: "bg-success",
  Started: "bg-success",
  Stopped: "bg-text-tertiary",
  Frozen: "bg-blue-400",
  Paused: "bg-blue-400",
  Error: "bg-danger",
};

export function instanceDotClass(status: string): string {
  return DOT[status] ?? "bg-text-tertiary";
}

export interface InstanceIconProps {
  status: string;
  type: "container" | "virtual-machine";
}

export function InstanceIcon({ status, type }: InstanceIconProps) {
  const Icon = type === "virtual-machine" ? Monitor : Box;
  return (
    <span className="relative inline-flex" data-testid="instance-icon">
      <Icon size={15} className="text-text-secondary" />
      <span className={`absolute -right-1 -top-0.5 h-2 w-2 rounded-full ${instanceDotClass(status)}`} />
    </span>
  );
}
```

`src/shell/tree-model.ts`:
```tsx
import { Link } from "react-router-dom";
import { Folder, Server, Palette, Gauge } from "lucide-react";
import type { TreeNode } from "../components/tree";
import type { ClusterMember, Instance } from "../api/types";
import { InstanceIcon } from "./instance-icon";

export interface TreeParams {
  project: string;
  members: ClusterMember[];
  instancesByMember: Record<string, Instance[]>;
  unassigned: Instance[];
}

const instanceNode = (i: Instance): TreeNode => ({
  id: `instance-${i.name}`,
  label: (
    <span className="flex items-center gap-2">
      <InstanceIcon status={i.status} type={i.type} />
      <span>{i.name}</span>
    </span>
  ),
});

export function buildTree({ project, members, instancesByMember, unassigned }: TreeParams): TreeNode[] {
  const memberNodes: TreeNode[] = [...members]
    .sort((a, b) => a.server_name.localeCompare(b.server_name))
    .map((m) => ({
      id: `member-${m.server_name}`,
      label: (
        <span className="flex items-center gap-2">
          <Server size={14} className="text-text-secondary" />
          <span>{m.server_name}</span>
          <span className={`h-2 w-2 rounded-full ${m.status === "Online" ? "bg-success" : "bg-text-tertiary"}`} />
        </span>
      ),
      children: (instancesByMember[m.server_name] ?? [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(instanceNode),
    }));

  if (unassigned.length > 0) {
    memberNodes.push({
      id: "unassigned",
      label: <span className="text-text-tertiary">unassigned</span>,
      children: [...unassigned].sort((a, b) => a.name.localeCompare(b.name)).map(instanceNode),
    });
  }

  return [
    {
      id: "dashboard",
      label: (
        <span className="flex items-center gap-2">
          <Gauge size={14} className="text-text-secondary" />
          <Link to="/dashboard">Dashboard</Link>
        </span>
      ),
    },
    {
      id: `project-${project}`,
      label: (
        <span className="flex items-center gap-2">
          <Folder size={14} className="text-text-secondary" />
          <Link to="/">{project}</Link>
        </span>
      ),
      children: memberNodes,
    },
    {
      id: "gallery",
      label: (
        <span className="flex items-center gap-2">
          <Palette size={14} className="text-text-secondary" />
          <Link to="/gallery">Component Gallery</Link>
        </span>
      ),
    },
  ];
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run src/shell/instance-icon.test.tsx src/shell/tree-model.test.ts && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/shell/instance-icon.tsx src/shell/instance-icon.test.tsx src/shell/tree-model.ts src/shell/tree-model.test.ts
git commit -m "feat: add instance icon and cluster tree model"
```

---

### Task 7: Sidebar Restructure (fixed panel, project dropdown, cluster tree)

**Files:**
- Delete: `src/shell/use-resource-counts.ts`
- Create: `src/shell/use-tree-data.ts`
- Rewrite: `src/shell/sidebar.tsx`
- Modify: `src/shell/shell.test.tsx` (mock adds `clusterApi.listMembers`; sidebar assertions)

**Interfaces:**
- Consumes: `buildTree`/`TreeParams` (Task 6), `ProjectDropdown` (Task 5), `clusterApi.listMembers`, `loadInstances`, `instancesStore`, `currentProjectStore`
- Produces:
  - `useTreeData(): { members: ClusterMember[]; instancesByMember: Record<string, Instance[]>; unassigned: Instance[] }` in `src/shell/use-tree-data.ts` — loads instances + members on project change; groups scoped instances by `location` (instances with `location` undefined/`"none"` go to `unassigned`)
  - `Sidebar` — fixed `w-60` panel (no collapse), header (orange mark + "Incus"), `ProjectDropdown`, `Tree` from `buildTree`, selection by route: `/dashboard` → `dashboard`, `/` → `project-<project>`, `/members/<name>` → `member-<name>`, `/instances/<name>` → `instance-<name>`, `/gallery` → `gallery`

- [ ] **Step 1: Write the hook**

`src/shell/use-tree-data.ts`:
```ts
import { useEffect, useState } from "react";
import { clusterApi } from "../api";
import { instancesStore, loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { ClusterMember, Instance } from "../api/types";

export interface TreeData {
  members: ClusterMember[];
  instancesByMember: Record<string, Instance[]>;
  unassigned: Instance[];
}

export function useTreeData(): TreeData {
  const project = useStore(currentProjectStore);
  const instances = useStore(instancesStore);
  const [members, setMembers] = useState<ClusterMember[]>([]);

  useEffect(() => {
    void loadInstances(project).catch(() => {});
  }, [project]);

  useEffect(() => {
    void clusterApi.listMembers().then(setMembers).catch(() => {});
  }, [project]);

  const byMember: Record<string, Instance[]> = {};
  const unassigned: Instance[] = [];
  for (const i of Object.values(instances)) {
    if (i.project !== project) continue;
    if (i.location && i.location !== "none") (byMember[i.location] ??= []).push(i);
    else unassigned.push(i);
  }

  return { members, instancesByMember: byMember, unassigned };
}
```

- [ ] **Step 2: Rewrite the sidebar**

`src/shell/sidebar.tsx`:
```tsx
import { useLocation } from "react-router-dom";
import { Tree } from "../components/tree";
import { ProjectDropdown } from "../components/project-dropdown";
import { buildTree } from "./tree-model";
import { useTreeData } from "./use-tree-data";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";

export function Sidebar() {
  const location = useLocation();
  const project = useStore(currentProjectStore);
  const { members, instancesByMember, unassigned } = useTreeData();

  const nodes = buildTree({ project, members, instancesByMember, unassigned });

  let selectedId: string | null = null;
  const p = location.pathname;
  if (p === "/dashboard") selectedId = "dashboard";
  else if (p === "/" ) selectedId = `project-${project}`;
  else if (p.startsWith("/members/")) selectedId = `member-${p.split("/")[2] ?? ""}`;
  else if (p.startsWith("/instances/")) selectedId = `instance-${p.split("/")[2] ?? ""}`;
  else if (p === "/gallery") selectedId = "gallery";

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar" data-testid="sidebar">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="h-3 w-3 rounded-sm bg-accent-600" data-testid="sidebar-mark" />
        <span className="text-sm font-semibold text-text-primary">Incus</span>
      </div>
      <ProjectDropdown />
      <div className="flex-1 overflow-y-auto py-2">
        <Tree nodes={nodes} selectedId={selectedId} />
      </div>
    </aside>
  );
}
```
Delete `src/shell/use-resource-counts.ts`.

- [ ] **Step 3: Update shell tests**

`src/shell/shell.test.tsx` — in the `vi.mock("../api", …)` factory, add:
```ts
clusterApi: { listMembers: vi.fn().mockResolvedValue([]) },
```
Update the sidebar test — replace the existing "renders sidebar…" assertion block with:
```tsx
it("renders sidebar with project dropdown and tree", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<div>home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByTestId("sidebar")).toBeInTheDocument();
  expect(screen.getByTestId("project-selector")).toBeInTheDocument();
  expect(screen.getByTestId("tree")).toBeInTheDocument();
});
```
Keep the task-log tests and App-level tests as they are (verify they still pass).

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass. (The App tests render at `/ui/` → index still `DashboardPage` until Task 8 — that's fine.)

- [ ] **Step 5: Commit**

```bash
git add src/shell
git commit -m "feat: restructure sidebar with cluster tree and project dropdown"
```

---

### Task 8: Project Overview Page + Routing Restructure

**Files:**
- Create: `src/pages/project-overview.tsx`, `src/pages/project-overview.test.tsx`
- Rewrite: `src/App.tsx` (routes), `src/shell/top-bar.tsx` (breadcrumbs)

**Interfaces:**
- Consumes: `VerticalTabs` (Task 4), page components (InstancesPage, ImagesPage, ProfilesPage, NetworksPage, StoragePage), `useSearchParams`, `currentProjectStore`
- Produces:
  - `ProjectOverview()` — header ("Project <name>" + Create button placeholder with `data-testid="overview-create"` — no-op until Task 13), `VerticalTabs` with icons (Instances `Boxes`, Images `Image`, Profiles `UserCog`?, Networks `Network`, Storage `Database`), tab content = the existing page components; reads/sets `?tab=` via `useSearchParams`; invalid tab → `instances`
  - Routes in `App.tsx`: index → `ProjectOverview`; `dashboard` → `DashboardPage`; `members/:name` → `MemberView` (Task 9 — stub route with a placeholder export until then); redirects `instances|images|profiles|networks|storage` → `/?tab=…`; keep `instances/:name/:tab?`, `gallery`, `*`
  - TopBar breadcrumbs: `/dashboard` → Incus/Dashboard; `/` → Incus/<project>; `/members/:name` → Incus/Members/<name>; `/instances/…` as today

- [ ] **Step 1: Write the failing test**

`src/pages/project-overview.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProjectOverview } from "./project-overview";

vi.mock("../api", () => ({
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  clusterApi: { listMembers: vi.fn().mockResolvedValue([]) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
    listPoolVolumes: vi.fn().mockResolvedValue([]),
  },
  api: { get: vi.fn() },
  eventStream: { connect: vi.fn(), onEvent: vi.fn() },
}));

describe("ProjectOverview", () => {
  it("renders vertical tabs and the default instances tab", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<ProjectOverview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("vertical-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("vtab-images")).toBeInTheDocument();
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
  });

  it("switches tabs via query param", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/?tab=images"]}>
        <Routes>
          <Route path="/" element={<ProjectOverview />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("images-page")).toBeInTheDocument();
    await user.click(screen.getByTestId("vtab-instances"));
    expect(screen.getByTestId("instances-page")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/project-overview.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/pages/project-overview.tsx`:
```tsx
import { Boxes, Database, Image as ImageIcon, Network, UserCog } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { VerticalTabs } from "../components/vertical-tabs";
import type { VerticalTabItem } from "../components/vertical-tabs";
import { useStore } from "../state/store";
import { currentProjectStore } from "../state/projects";
import { InstancesPage } from "./instances";
import { ImagesPage } from "./images";
import { ProfilesPage } from "./profiles";
import { NetworksPage } from "./networks";
import { StoragePage } from "./storage";

const TAB_KEYS = ["instances", "images", "profiles", "networks", "storage"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: VerticalTabItem[] = [
  { key: "instances", label: "Instances", icon: <Boxes size={14} /> },
  { key: "images", label: "Images", icon: <ImageIcon size={14} /> },
  { key: "profiles", label: "Profiles", icon: <UserCog size={14} /> },
  { key: "networks", label: "Networks", icon: <Network size={14} /> },
  { key: "storage", label: "Storage pools", icon: <Database size={14} /> },
];

export function ProjectOverview() {
  const project = useStore(currentProjectStore);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: TabKey = TAB_KEYS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "instances";

  const setTab = (key: string) => {
    setSearchParams({ tab: key }, { replace: false });
  };

  return (
    <div className="flex h-full" data-testid="project-overview">
      <VerticalTabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="min-w-0 flex-1 overflow-auto">
        {tab === "instances" && <InstancesPage />}
        {tab === "images" && <ImagesPage />}
        {tab === "profiles" && <ProfilesPage />}
        {tab === "networks" && <NetworksPage />}
        {tab === "storage" && <StoragePage />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update routing and top bar**

`src/App.tsx` — replace the routes block:
```tsx
<Routes>
  <Route element={<Shell />}>
    <Route index element={<ProjectOverview />} />
    <Route path="dashboard" element={<DashboardPage />} />
    <Route path="members/:name" element={<MemberView />} />
    <Route path="instances" element={<Navigate to="/?tab=instances" replace />} />
    <Route path="images" element={<Navigate to="/?tab=images" replace />} />
    <Route path="profiles" element={<Navigate to="/?tab=profiles" replace />} />
    <Route path="networks" element={<Navigate to="/?tab=networks" replace />} />
    <Route path="storage" element={<Navigate to="/?tab=storage" replace />} />
    <Route path="instances/:name/:tab?" element={<InstanceDetailPage />} />
    <Route path="gallery" element={<Gallery />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route>
</Routes>
```
Add imports for `ProjectOverview` and `MemberView`.

Create a temporary stub `src/pages/member-view.tsx` (real content in Task 9):
```tsx
export function MemberView() {
  return <div data-testid="member-view">Member view</div>;
}
```

`src/shell/top-bar.tsx` — rewrite the crumb-building block:
```tsx
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
```

- [ ] **Step 5: Update shell tests for the new index route**

`src/shell/shell.test.tsx` — the App-level test renders at `/ui/`; the index is now `ProjectOverview`. The `../api` mock must include what ProjectOverview's default tab needs (`instancesApi.list`, `clusterApi.listMembers` — already added in Task 7). If the "renders shell when authenticated" test asserts something index-specific, keep the assertion generic (`getByTestId("shell")`). Run and fix any stale queries.

- [ ] **Step 6: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/project-overview.tsx src/pages/project-overview.test.tsx src/pages/member-view.tsx src/App.tsx src/shell/top-bar.tsx
git commit -m "feat: project overview with vertical tabs and route restructure"
```

---

### Task 9: Member View + InstancesPage location Filter

**Files:**
- Modify: `src/pages/instances.tsx` (add `location` prop; remove the create-button navigation)
- Rewrite: `src/pages/member-view.tsx` (real content)
- Create: `src/pages/member-view.test.tsx`
- Modify: `src/pages/instances.test.tsx` (no create-button tests exist — verify; if the page change breaks any assertion, update)

**Interfaces:**
- Consumes: `instancesStore`, `useTreeData`-style member data (fetch members in MemberView), `InstancesPage`
- Produces:
  - `InstancesPage({ location }: { location?: string } = {})` — when `location` is provided, filters `scoped` to instances with that location; when absent, all project instances. The "Create instance" button and its `navigate("/instances/new")` are REMOVED.
  - `MemberView()` — reads `:name` param; fetches members via `clusterApi.listMembers()`; header: `Server` icon, member name, architecture + status badge; content: `<InstancesPage location={name} />`; not-found state when the member doesn't exist; `data-testid="member-view"`

- [ ] **Step 1: Modify InstancesPage**

`src/pages/instances.tsx`:
- Signature: `export function InstancesPage({ location }: { location?: string } = {})`
- `scoped` filter:
```tsx
const scoped = useMemo(
  () => Object.values(instances).filter((i) => i.project === project && (location === undefined || i.location === location)),
  [instances, project, location]
);
```
- Remove the `Create instance` button (the one with `data-testid="action-create"` and `onClick={() => navigate("/instances/new")}`) and the `action-create` testid from the toolbar; if `useNavigate` becomes unused, remove its import and the `navigate` variable (row click still uses it — keep it).

- [ ] **Step 2: Write the failing test**

`src/pages/member-view.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MemberView } from "./member-view";

vi.mock("../api", () => ({
  clusterApi: {
    listMembers: vi.fn().mockResolvedValue([
      { server_name: "incus-1", url: "", database: true, status: "Online", message: "", architecture: "x86_64" },
    ]),
  },
  instancesApi: { list: vi.fn().mockResolvedValue([]) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  api: { get: vi.fn() },
}));

describe("MemberView", () => {
  it("shows member info and the instances table", async () => {
    render(
      <MemoryRouter initialEntries={["/members/incus-1"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("member-view")).toBeInTheDocument();
    expect(screen.getByText("incus-1")).toBeInTheDocument();
    expect(screen.getByText("x86_64")).toBeInTheDocument();
  });

  it("shows not found for unknown members", async () => {
    render(
      <MemoryRouter initialEntries={["/members/ghost"]}>
        <Routes>
          <Route path="/members/:name" element={<MemberView />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("Member not found")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/pages/member-view.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement MemberView**

`src/pages/member-view.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Server } from "lucide-react";
import { clusterApi } from "../api";
import type { ClusterMember } from "../api/types";
import { Badge } from "../components/badge";
import { InstancesPage } from "./instances";

export function MemberView() {
  const { name = "" } = useParams();
  const [members, setMembers] = useState<ClusterMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void clusterApi.listMembers().then((m) => {
      setMembers(m);
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  const member = members.find((m) => m.server_name === name);

  if (loaded && !member) {
    return (
      <div className="p-6" data-testid="member-view">
        <h1 className="text-lg font-semibold text-text-primary">Member not found</h1>
      </div>
    );
  }

  return (
    <div data-testid="member-view">
      {member && (
        <div className="flex items-center gap-3 border-b border-border bg-surface-900 px-6 py-3">
          <Server size={18} className="text-text-secondary" />
          <h1 className="text-base font-semibold text-text-primary">{member.server_name}</h1>
          <Badge tone={member.status === "Online" ? "success" : "neutral"}>{member.status}</Badge>
          <span className="text-xs text-text-tertiary">{member.architecture}</span>
        </div>
      )}
      <InstancesPage location={name} />
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass. (If `instances.test.tsx` or `project-overview.test.tsx` referenced the removed create button, update those assertions — the plan removed `action-create`.)

- [ ] **Step 6: Commit**

```bash
git add src/pages/instances.tsx src/pages/member-view.tsx src/pages/member-view.test.tsx
git commit -m "feat: member view with location-filtered instances"
```

---

### Task 10: Instance Detail Side Tabs + Status Icon

**Files:**
- Modify: `src/shell/instance-icon.tsx` (add `InstanceStatusIcon`)
- Modify: `src/pages/instance-detail.tsx` (VerticalTabs + status icon in header)
- Modify: `src/pages/instance-detail.test.tsx` (tab queries `tab-` → `vtab-`)

**Interfaces:**
- Consumes: `VerticalTabs` (Task 4), lucide icons
- Produces:
  - `InstanceStatusIcon({ status }: { status: string })` in `src/shell/instance-icon.tsx` — colored lucide icon: `Running`/`Started` → `Play` green (`text-success`), `Stopped` → `Square` gray (`text-text-tertiary`), `Frozen`/`Paused` → `Snowflake` blue, `Error` → `TriangleAlert` red; `data-testid="instance-status-icon"`
  - `InstanceDetailPage` — header shows `InstanceStatusIcon` next to the name; the top `Tabs` replaced by `VerticalTabs` in a flex row layout (tabs column + content); tab icons: Overview `Gauge`, Console `Terminal`, Snapshots `Camera`, Config `Settings`, Logs `FileText`

- [ ] **Step 1: Add InstanceStatusIcon**

`src/shell/instance-icon.tsx` — append:
```tsx
import { Play, Square, Snowflake, TriangleAlert } from "lucide-react";

const STATUS_ICON: Record<string, { Icon: typeof Play; className: string }> = {
  Running: { Icon: Play, className: "text-success" },
  Started: { Icon: Play, className: "text-success" },
  Stopped: { Icon: Square, className: "text-text-tertiary" },
  Frozen: { Icon: Snowflake, className: "text-blue-400" },
  Paused: { Icon: Snowflake, className: "text-blue-400" },
  Error: { Icon: TriangleAlert, className: "text-danger" },
};

export function InstanceStatusIcon({ status }: { status: string }) {
  const entry = STATUS_ICON[status] ?? { Icon: Square, className: "text-text-tertiary" };
  const { Icon, className } = entry;
  return <Icon size={16} className={className} data-testid="instance-status-icon" />;
}
```

- [ ] **Step 2: Update the detail page**

`src/pages/instance-detail.tsx`:
- Import `VerticalTabs` and lucide icons (`Gauge`, `Terminal`, `Camera`, `Settings`, `FileText`), plus `InstanceStatusIcon` from `../shell/instance-icon`.
- Replace the `Tabs` usage:
```tsx
const tabs = [
  { key: "overview", label: "Overview", icon: <Gauge size={14} /> },
  { key: "console", label: "Console", icon: <Terminal size={14} /> },
  { key: "snapshots", label: "Snapshots", icon: <Camera size={14} /> },
  { key: "config", label: "Config", icon: <Settings size={14} /> },
  { key: "logs", label: "Logs", icon: <FileText size={14} /> },
];
```
- Header: next to `<h1>{instance.name}</h1>` add `<InstanceStatusIcon status={instance.status} />`.
- Layout: wrap in a flex row:
```tsx
<div className="flex h-full">
  <VerticalTabs tabs={tabs} active={tab} onChange={(key) => navigate(`/instances/${name}/${key}`)} />
  <div className="min-w-0 flex-1 overflow-auto p-6">
    {tab === "overview" && <OverviewTab instance={instance} />}
    {tab === "console" && <ConsoleTab instanceName={name} />}
    {tab === "snapshots" && <SnapshotsTab instanceName={name} />}
    {tab === "config" && <ConfigTab instanceName={name} />}
    {tab === "logs" && <LogsTab instanceName={name} />}
  </div>
</div>
```
(The header row with name/actions stays above this flex row, inside the page container. Adjust the existing wrapper classes: the page root was `space-y-4 p-6` — keep the header in a padded block and let the tabs+content fill the rest.)

- [ ] **Step 3: Update the detail tests**

`src/pages/instance-detail.test.tsx` — change the tab-switch test:
```tsx
await user.click(screen.getByTestId("tab-config"));
```
to:
```tsx
await user.click(screen.getByTestId("vtab-config"));
```

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/shell/instance-icon.tsx src/pages/instance-detail.tsx src/pages/instance-detail.test.tsx
git commit -m "feat: side tabs and status icons on instance detail"
```

---

### Task 11: Header Band + Sidebar Mark Polish

**Files:**
- Modify: `src/shell/top-bar.tsx` (accent band), `src/shell/layout.tsx` (no change needed), `src/shell/sidebar.tsx` (already has mark from Task 7)

**Interfaces:**
- Consumes: existing shell
- Produces: TopBar with a `border-t-2 border-accent-600` accent strip at the very top of the shell

- [ ] **Step 1: Add the accent band**

`src/shell/top-bar.tsx` — wrap the header in a fragment and add the strip:
```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/shell/top-bar.tsx
git commit -m "feat: accent header band"
```

---

### Task 12: Floating Create Wizard

**Files:**
- Create: `src/components/create-instance-wizard.tsx`, `src/components/create-instance-wizard.test.tsx`

**Interfaces:**
- Consumes: `Window` (Task 3), `instancesApi.create`, `operationsApi.wait`, `infraApi.listImages/listProfiles/listNetworks/pullImage`, `loadInstances`, `currentProjectStore`, toast
- Produces: `CreateInstanceWizard({ open, onClose })`:
  - Stage 1 — Type & basics: radio cards `data-testid="wizard-type-container"` / `wizard-type-virtual-machine"` (icon + label), name `wizard-name` (regex `/^[a-zA-Z0-9-]+$/`, error message "Name must contain only letters, numbers, and hyphens"), description `wizard-description`; Next `wizard-next` disabled while name invalid
  - Stage 2 — Image: search input `wizard-image-search` filtering local images of the chosen type (list `wizard-image-<fingerprint>`), pull expander: `wizard-pull-toggle`, `wizard-pull-alias`, `wizard-pull-server` (prefilled `https://images.linuxcontainers.org`), `wizard-pull-submit` → `infraApi.pullImage` + refresh
  - Stage 3 — Profiles & resources: profile checkboxes `wizard-profile-<name>` (default `["default"]`), memory `wizard-memory`, cpu `wizard-cpu`, network select `wizard-network` (networks of the current project, empty option allowed)
  - Stage 4 — Review & create: summary `wizard-summary`; Create `wizard-create` → `instancesApi.create({ name, type, profiles, source: { type: "image", fingerprint }, config: limits, devices: { eth0: { nictype: "bridged", parent: network } } | undefined })` → if async, `operationsApi.wait` → require `status === "Success"` else throw `op.err` → toast success → `loadInstances(project)` → `onClose()`; failure → toast danger, stays open
  - Back `wizard-back` preserves all state; stage indicator `wizard-stage` ("Stage 1 of 4")
  - Escape mid-wizard → `onClose` (Window handles Escape; no confirm needed in v1)

- [ ] **Step 1: Write the failing test**

`src/components/create-instance-wizard.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateInstanceWizard } from "./create-instance-wizard";

vi.mock("../api", () => ({
  instancesApi: {
    create: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "/1.0/operations/op1", metadata: null }),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ id: "op1", class: "task", description: "", status: "Success", status_code: 200, created_at: "t", updated_at: "t", may_cancel: false }) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([{ fingerprint: "f1", filename: "f1.img", description: "Ubuntu 24.04", public: true, created_at: "t", size: 100, type: "container", properties: {} }]),
    listProfiles: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {}, devices: {} }]),
    listNetworks: vi.fn().mockResolvedValue([{ name: "br0", description: "", type: "bridge", managed: true, used_by: [], status: "Created" }]),
    pullImage: vi.fn().mockResolvedValue(null),
  },
  api: { get: vi.fn() },
}));

describe("CreateInstanceWizard", () => {
  it("gates stage 1 on a valid name", async () => {
    const user = userEvent.setup();
    render(<CreateInstanceWizard open onClose={() => {}} />);
    await user.type(screen.getByTestId("wizard-name"), "bad name!");
    expect(screen.getByText("Name must contain only letters, numbers, and hyphens")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-next")).toBeDisabled();
    await user.clear(screen.getByTestId("wizard-name"));
    await user.type(screen.getByTestId("wizard-name"), "web1");
    expect(screen.getByTestId("wizard-next")).toBeEnabled();
  });

  it("walks through stages and creates the instance", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi, operationsApi, infraApi } = await import("../api");
    render(<CreateInstanceWizard open onClose={onClose} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    expect(await screen.findByTestId("wizard-image-f1")).toBeInTheDocument();
    await user.click(screen.getByTestId("wizard-image-f1"));
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-next"));
    expect(screen.getByTestId("wizard-summary")).toHaveTextContent("web1");
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "web1", type: "container", source: expect.objectContaining({ fingerprint: "f1" }) })));
    expect(operationsApi.wait).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps state when going back", async () => {
    const user = userEvent.setup();
    render(<CreateInstanceWizard open onClose={() => {}} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-back"));
    expect(screen.getByTestId("wizard-name")).toHaveValue("web1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/create-instance-wizard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/components/create-instance-wizard.tsx`:
```tsx
import { useEffect, useMemo, useState } from "react";
import { Box, Monitor, Search, RefreshCw } from "lucide-react";
import { Window } from "./window";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Checkbox } from "./checkbox";
import { instancesApi, operationsApi, infraApi } from "../api";
import { loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { toast } from "./toast";
import type { Image, Profile, Network } from "../api/types";

export interface CreateInstanceWizardProps {
  open: boolean;
  onClose: () => void;
}

const LIMIT_KEYS: Record<string, string> = { memory: "limits.memory", cpu: "limits.cpu" };

export function CreateInstanceWizard({ open, onClose }: CreateInstanceWizardProps) {
  const project = useStore(currentProjectStore);
  const [stage, setStage] = useState(1);
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFingerprint, setImageFingerprint] = useState("");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<string[]>(["default"]);
  const [memory, setMemory] = useState("");
  const [cpu, setCpu] = useState("");
  const [network, setNetwork] = useState("");
  const [images, setImages] = useState<Image[]>([]);
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [networkList, setNetworkList] = useState<Network[]>([]);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullAlias, setPullAlias] = useState("");
  const [pullServer, setPullServer] = useState("https://images.linuxcontainers.org");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([infraApi.listImages(), infraApi.listProfiles(), infraApi.listNetworks()])
      .then(([imgs, profs, nets]) => {
        setImages(imgs);
        setProfileList(profs);
        setNetworkList(nets);
      })
      .catch(() => {});
  }, [open]);

  const nameValid = /^[a-zA-Z0-9-]+$/.test(name.trim());
  const filteredImages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return images.filter((i) => i.type === type && (q === "" || (i.description + i.filename + (i.properties?.description ?? "")).toLowerCase().includes(q)));
  }, [images, type, search]);

  const stage2Complete = imageFingerprint !== "";
  const stage4Complete = nameValid && imageFingerprint !== "";

  const next = () => {
    if (stage === 1 && !nameValid) return;
    if (stage === 2 && !stage2Complete) return;
    setStage((s) => Math.min(4, s + 1));
  };
  const back = () => setStage((s) => Math.max(1, s - 1));

  const pull = async () => {
    setBusy(true);
    try {
      await infraApi.pullImage({ alias: pullAlias.trim(), server: pullServer.trim() });
      toast("success", `Pulling ${pullAlias.trim()}`);
      const imgs = await infraApi.listImages();
      setImages(imgs);
      setPullOpen(false);
      setPullAlias("");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!stage4Complete) return;
    setBusy(true);
    try {
      const config: Record<string, string> = {};
      if (memory.trim()) config[LIMIT_KEYS.memory] = memory.trim();
      if (cpu.trim()) config[LIMIT_KEYS.cpu] = cpu.trim();
      const devices: Record<string, Record<string, string>> | undefined = network
        ? { eth0: { nictype: "bridged", parent: network } }
        : undefined;
      const result = await instancesApi.create({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        profiles,
        source: { type: "image", fingerprint: imageFingerprint },
        config,
        devices,
      });
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Create failed");
      }
      toast("success", `Instance ${name.trim()} created`);
      void loadInstances(project).catch(() => {});
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Window
      open={open}
      onClose={onClose}
      title="Create instance"
      subtitle={`Stage ${stage} of 4`}
      footer={
        <>
          {stage > 1 && <Button variant="secondary" onClick={back} data-testid="wizard-back">Back</Button>}
          {stage < 4 && <Button onClick={next} disabled={stage === 1 ? !nameValid : stage === 2 ? !stage2Complete : false} data-testid="wizard-next">Next</Button>}
          {stage === 4 && <Button onClick={create} loading={busy} data-testid="wizard-create">Create</Button>}
        </>
      }
    >
      <div data-testid="wizard-stage">
        {stage === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["container", "virtual-machine"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`wizard-type-${t}`}
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-2 rounded border p-4 ${type === t ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-700"}`}
                >
                  {t === "container" ? <Box size={22} /> : <Monitor size={22} />}
                  <span className="text-[13px] font-medium">{t === "container" ? "Container" : "Virtual machine"}</span>
                </button>
              ))}
            </div>
            <Input label="Name" name="wizard-name" data-testid="wizard-name" value={name} onChange={(e) => setName(e.target.value)} error={name && !nameValid ? "Name must contain only letters, numbers, and hyphens" : undefined} />
            <Input label="Description (optional)" name="wizard-description" data-testid="wizard-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        )}
        {stage === 2 && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-text-tertiary" />
              <input
                data-testid="wizard-image-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search images…"
                className="h-8 w-full rounded border border-border bg-surface-500 pl-8 pr-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-auto">
              {filteredImages.length === 0 && <p className="py-4 text-center text-xs text-text-tertiary">No images for this type.</p>}
              {filteredImages.map((img) => (
                <button
                  key={img.fingerprint}
                  type="button"
                  data-testid={`wizard-image-${img.fingerprint}`}
                  onClick={() => setImageFingerprint(img.fingerprint)}
                  className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-[13px] ${imageFingerprint === img.fingerprint ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-700"}`}
                >
                  <span className="truncate">{img.properties?.description ?? img.description ?? img.filename}</span>
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-text-tertiary">{img.fingerprint.slice(0, 8)}</span>
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPullOpen((o) => !o)} data-testid="wizard-pull-toggle">
              <RefreshCw size={13} /> Pull from remote
            </Button>
            {pullOpen && (
              <div className="space-y-2 rounded border border-border bg-surface-900 p-3">
                <Input label="Alias" name="pull-alias" data-testid="wizard-pull-alias" value={pullAlias} onChange={(e) => setPullAlias(e.target.value)} placeholder="ubuntu/24.04" />
                <Input label="Server" name="pull-server" data-testid="wizard-pull-server" value={pullServer} onChange={(e) => setPullServer(e.target.value)} />
                <Button size="sm" onClick={pull} loading={busy} data-testid="wizard-pull-submit">Pull</Button>
              </div>
            )}
          </div>
        )}
        {stage === 3 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-text-secondary">Profiles</legend>
              <div className="flex flex-wrap gap-3">
                {profileList.map((p) => (
                  <Checkbox key={p.name} label={p.name} data-testid={`wizard-profile-${p.name}`} checked={profiles.includes(p.name)} onChange={(e) => {
                    if (e.target.checked) setProfiles((prev) => [...prev, p.name]);
                    else setProfiles((prev) => prev.filter((n) => n !== p.name));
                  }} />
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Memory limit (e.g. 512MiB)" name="wizard-memory" data-testid="wizard-memory" value={memory} onChange={(e) => setMemory(e.target.value)} />
              <Input label="CPU limit (e.g. 2)" name="wizard-cpu" data-testid="wizard-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <Select label="Network" name="wizard-network" data-testid="wizard-network" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">— none —</option>
              {networkList.map((n) => (
                <option key={n.name} value={n.name}>{n.name}</option>
              ))}
            </Select>
          </div>
        )}
        {stage === 4 && (
          <div data-testid="wizard-summary" className="space-y-1.5 text-[13px]">
            <p><span className="text-text-tertiary">Name:</span> {name.trim()}</p>
            <p><span className="text-text-tertiary">Type:</span> {type === "container" ? "Container" : "Virtual machine"}</p>
            <p><span className="text-text-tertiary">Image:</span> {filteredImages.find((i) => i.fingerprint === imageFingerprint)?.properties?.description ?? imageFingerprint.slice(0, 8)}</p>
            <p><span className="text-text-tertiary">Profiles:</span> {profiles.join(", ") || "—"}</p>
            {memory.trim() && <p><span className="text-text-tertiary">Memory:</span> {memory.trim()}</p>}
            {cpu.trim() && <p><span className="text-text-tertiary">CPU:</span> {cpu.trim()}</p>}
            {network && <p><span className="text-text-tertiary">Network:</span> {network}</p>}
          </div>
        )}
      </div>
    </Window>
  );
}
```
NOTE: `data-testid` on `Checkbox` — the Checkbox primitive spreads rest props onto the native input, so `data-testid="wizard-profile-<name>"` lands on the input; the test clicks it via `user.click(screen.getByTestId(...))` which works. The `next`/`back` stage math keeps `stage` 1–4.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/components/create-instance-wizard.test.tsx && npm run typecheck && npm run lint`
Expected: 3 tests pass, gates clean. (If the "walks through stages" test needs the search box cleared of interfering state, reset `search` state between tests via a `beforeEach` unmount — the wizard resets on `open` only; tests render fresh each time so state is fresh.)

- [ ] **Step 5: Commit**

```bash
git add src/components/create-instance-wizard.tsx src/components/create-instance-wizard.test.tsx
git commit -m "feat: floating create instance wizard with stages"
```

---

### Task 13: Wire Wizard Entries, Remove Old Create Page

**Files:**
- Modify: `src/pages/project-overview.tsx` (header Create button opens wizard)
- Modify: `src/pages/instances.tsx` (accept `onCreate` prop, render toolbar Create button calling it)
- Modify: `src/pages/member-view.tsx` (no button — pass nothing)
- Modify: `src/App.tsx` (remove `/instances/new` route)
- Delete: `src/pages/instance-create.tsx`, `src/pages/instance-create.test.tsx`
- Modify: `src/pages/project-overview.test.tsx` (mock no longer needs anything new; add wizard-open assertion)

**Interfaces:**
- Consumes: `CreateInstanceWizard` (Task 12)
- Produces: `InstancesPage({ location?, onCreate? }: { location?: string; onCreate?: () => void })` — renders the Create button (`data-testid="action-create"`) only when `onCreate` is provided; `ProjectOverview` holds `wizardOpen` state, renders `<CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />`, passes `onCreate={() => setWizardOpen(true)}` to InstancesPage, and adds a header button `data-testid="overview-create"`

- [ ] **Step 1: Update InstancesPage**

`src/pages/instances.tsx`:
- Signature: `export function InstancesPage({ location, onCreate }: { location?: string; onCreate?: () => void } = {})`
- In the toolbar, replace the removed create button with:
```tsx
{onCreate && <Button size="sm" onClick={onCreate} data-testid="action-create">Create instance</Button>}
```

- [ ] **Step 2: Update ProjectOverview**

`src/pages/project-overview.tsx`:
- Add state: `const [wizardOpen, setWizardOpen] = useState(false);`
- Render a header above the tabs row:
```tsx
<div className="flex items-center justify-between border-b border-border bg-surface-900 px-4 py-2.5">
  <h1 className="text-sm font-semibold text-text-primary">Project {project}</h1>
  <Button size="sm" data-testid="overview-create" onClick={() => setWizardOpen(true)}>Create instance</Button>
</div>
```
- Pass `onCreate={() => setWizardOpen(true)}` to `<InstancesPage />`.
- Mount: `<CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />`
- Imports: `useState`, `Button`, `CreateInstanceWizard`.

- [ ] **Step 3: Remove the old page and route**

- Delete `src/pages/instance-create.tsx` and `src/pages/instance-create.test.tsx`.
- In `src/App.tsx`: remove the `instances/new` route and the `InstanceCreatePage` import.

- [ ] **Step 4: Update tests**

`src/pages/project-overview.test.tsx` — add:
```tsx
it("opens the create wizard from the header", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<ProjectOverview />} />
      </Routes>
    </MemoryRouter>
  );
  await user.click(await screen.findByTestId("overview-create"));
  expect(screen.getByTestId("window")).toBeInTheDocument();
});
```
(The `../api` mock in that file must now also satisfy the wizard's mount effects — `instancesApi.create`, `operationsApi.wait` — add them as `vi.fn().mockResolvedValue(null)` / `mockResolvedValue({ status: "Success" })` if the wizard mounts on open and fetches lists. The wizard fetches lists on `open`; since `open` starts false, no fetch happens until opened — the added test opens it, so add the mocks.)

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass (old instance-create tests removed with the file).

- [ ] **Step 6: Commit**

```bash
git add src/pages src/App.tsx
git commit -m "feat: wire wizard entries, remove create page"
```

---

### Task 14: Gallery + README + Full Verification

**Files:**
- Modify: `src/pages/gallery.tsx` (add Window, VerticalTabs, ProjectDropdown, InstanceIcon sections)
- Modify: `README.md` (cluster tree, wizard, lucide)
- Test: none new — full gates + manual Playwright verification

**Interfaces:**
- Consumes: everything
- Produces: updated gallery + docs; verified build

- [ ] **Step 1: Extend the gallery**

`src/pages/gallery.tsx` — add imports and sections (after the existing "Overlay" section):
```tsx
import { Window } from "../components/window";
import { VerticalTabs } from "../components/vertical-tabs";
import { ProjectDropdown } from "../components/project-dropdown";
import { InstanceIcon } from "../shell/instance-icon";
```
New state: `const [windowOpen, setWindowOpen] = useState(false);` and `const [vtab, setVtab] = useState("a");`

Sections:
```tsx
<Section title="Window">
  <Button onClick={() => setWindowOpen(true)}>Open window</Button>
  <Window open={windowOpen} onClose={() => setWindowOpen(false)} title="Example window" footer={<Button size="sm">OK</Button>}>
    A floating window body.
  </Window>
</Section>

<Section title="VerticalTabs">
  <VerticalTabs tabs={[{ key: "a", label: "Tab A" }, { key: "b", label: "Tab B" }]} active={vtab} onChange={setVtab} />
</Section>

<Section title="ProjectDropdown">
  <div className="w-56"><ProjectDropdown /></div>
</Section>

<Section title="InstanceIcon">
  <InstanceIcon status="Running" type="container" />
  <InstanceIcon status="Stopped" type="virtual-machine" />
  <InstanceIcon status="Error" type="container" />
</Section>
```

- [ ] **Step 2: Update the README**

`README.md` — update the intro paragraph and add bullets:
- Intro: mention the cluster-aware tree, project selector, vertical tabs, and the floating create wizard.
- In the dev section, add: `lucide-react` is the only icon dependency (component system rule: no other UI libraries).
- In the component-system section: add Window, VerticalTabs, ProjectDropdown to the primitive list and mention the gallery showcases them.

- [ ] **Step 3: Full gates + build**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: all pass; `dist/` emits with `/ui/assets/` links.

- [ ] **Step 4: Manual Playwright verification against the live cluster**

Run: `INCUS_TARGET=https://192.168.0.101:8443 npm run dev`, then in a browser:
1. `/ui/` — project overview with vertical tabs; instances tab lists real instances
2. Sidebar — project dropdown, member nodes with nested instances showing type icons + status dots
3. `/ui/instances/<name>` — side tabs render; header shows the status icon
4. `/ui/dashboard` — server info + gauges still work
5. Click "Create instance" — window opens, walk all 4 stages, create a test container, confirm it appears in the tree
6. `/ui/members/<member>` — member view lists only that member's instances

Expected: all flows work against the real cluster. Report what you observed honestly.

- [ ] **Step 5: Commit**

```bash
git add src/pages/gallery.tsx README.md
git commit -m "docs: gallery additions and readme update for redesign"
```
