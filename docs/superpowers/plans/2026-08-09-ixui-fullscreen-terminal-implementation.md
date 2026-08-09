# ixui Full-Screen Layout + Terminal Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ixui full-screen (no page/table padding), move the terminal out of the instance tabs into a browser-popup page (`/terminal/:name` with shell + VGA toggle) opened from an all-in-one instance action strip, add hover create buttons to the sidebar tree (member-targeted creation), add icons to every button, and add an Overview row action to instance tables.

**Architecture:** Five independent workstreams with disjoint files (parallel-safe): (1) layout pass on shared primitives + landing pages; (2) terminal extraction from `ConsoleTab` into a standalone popup route + the instance action strip; (3) tree hover actions + wizard `targetMember` + API `target` param; (4) icon pass on the resource pages; (5) instance-table icons + Overview row action; then one final verification task. The terminal websocket logic (binary frames, control socket, resize, session guard) is copied verbatim from the existing, live-verified `ConsoleTab`.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4 tokens, react-router-dom 7, lucide-react, xterm 5 + @xterm/addon-fit, Vitest + RTL.

## Global Constraints

- Runtime dependencies are ONLY: react, react-dom, react-router-dom, xterm, @xterm/addon-fit, lucide-react. No other UI libraries.
- TypeScript strict. No `any`.
- All interactive elements get a data-testid.
- Every commit must pass: `npx vitest run`, `npm run typecheck`, `npm run lint`.
- Tests never hit the network.
- Full-screen layout: no `p-6` page wrappers on dashboard, project overview content, instance detail, member view, or the resource pages; `Table` drops its rounded-border wrapper and tightens cells to `px-2 py-1`; `VerticalTabs` keeps `border-r` but loses outer padding gaps; sidebar + task log unchanged.
- Terminal: popup route `/terminal/:name` is OUTSIDE the `Shell` element (bare page); the all-in-one action strip (name + status icon + Start/Stop/Restart/Delete + Terminal) replaces the instance-detail header block; `ConsoleTab` and `console.test.tsx` are deleted.
- Tree hover `+`: `TreeNode` gains `action?: ReactNode`; project node → wizard without target; member node → wizard with `targetMember` → `POST /1.0/instances?project=…&target=<member>`.
- Icons: lucide size 14 before labels on all action buttons; wizard Create = `Check`, everything else per the spec table.

---

### Task 1: Full-Screen Layout Core

**Files:**
- Modify: `src/components/table.tsx`, `src/components/vertical-tabs.tsx`, `src/pages/dashboard.tsx`, `src/pages/project-overview.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: flush layout — no `p-6` on dashboard/overview, borderless tables with `px-2 py-1` cells, flush `VerticalTabs` (no `p-1.5`, gap stays `gap-0`)

- [ ] **Step 1: Table — drop the wrapper, tighten cells**

`src/components/table.tsx`:
- Replace the outer wrapper `<div className="overflow-x-auto rounded border border-border">` with `<div className="overflow-x-auto">` (borders now come from the header row's `border-b`).
- Thead: change `<thead className="bg-surface-700 text-left text-xs text-text-secondary">` to add `border-b border-border`, and th classes `px-2.5 py-1.5` → `px-2 py-1`.
- Tbody: `divide-y divide-border` stays; td classes `px-2.5 py-1.5` → `px-2 py-1` (both the checkbox cell and column cells).
- The empty-state cell `px-3 py-8` → `px-2 py-8`.

- [ ] **Step 2: VerticalTabs — flush**

`src/components/vertical-tabs.tsx`: container `flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-surface-900 p-1.5` → `flex w-44 shrink-0 flex-col border-r border-border bg-surface-900` (drop `gap-0.5` and `p-1.5`; tab buttons keep their own `px-2.5 py-1.5`).

- [ ] **Step 3: Dashboard — remove page padding**

`src/pages/dashboard.tsx`: root `<div className="space-y-4 p-6" data-testid="dashboard-page">` → `<div className="space-y-4" data-testid="dashboard-page">`. Keep all inner card/panel paddings.

- [ ] **Step 4: Project overview — remove page padding**

`src/pages/project-overview.tsx`: the content area `<div className="min-w-0 flex-1 overflow-auto">` stays (no padding to remove there — verify the tab content pages keep their own spacing); the header strip `px-4 py-2.5` stays. No change needed unless a `p-6` exists — grep and remove any.

- [ ] **Step 5: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass (tests assert testids/text, not paddings or wrapper classes).

- [ ] **Step 6: Commit**

```bash
git add src/components/table.tsx src/components/vertical-tabs.tsx src/pages/dashboard.tsx src/pages/project-overview.tsx
git commit -m "feat: full-screen layout core (tables, tabs, landing pages)"
```

---

### Task 2: Terminal Popup + Instance Action Strip

**Files:**
- Create: `src/pages/instance-terminal.tsx`, `src/pages/instance-terminal.test.tsx`
- Modify: `src/App.tsx` (route), `src/pages/instance-detail.tsx` (strip + remove Console tab), `src/pages/instance-detail.test.tsx`
- Delete: `src/pages/instance/console.tsx`, `src/pages/instance/console.test.tsx`

**Interfaces:**
- Consumes: `instancesApi.exec/console`, xterm, `instanceStatusIcon` (from `../shell/instance-icon`), lucide icons
- Produces:
  - `InstanceTerminal({ instanceName }: { instanceName: string })` in `src/pages/instance-terminal.tsx` — full-viewport (`h-screen`) terminal; auto-connects shell (exec) on mount; toggle buttons `data-testid="term-shell"` / `data-testid="term-vga"` switch kind (disconnect + reconnect); error line `data-testid="term-error"`; uses the EXACT protocol logic from the current `src/pages/instance/console.tsx` (binary frames, control socket, resize flush, session guard, cleanup on unmount) — copy it verbatim, minus the Button chrome and `h-96` container (container becomes `flex-1 min-h-0` inside a `flex h-screen flex-col` root with a slim header showing the instance name).
  - Route in `App.tsx`: `<Route path="terminal/:name" element={<TerminalPage />} />` OUTSIDE the `<Route element={<Shell />}>` block, inside `BrowserRouter`; `TerminalPage` reads `useParams().name` and renders `<InstanceTerminal instanceName={name} />` + the app background.
  - `InstanceDetailPage` changes: Console tab removed from the `tabs` array (icons Gauge/Terminal/Camera/Settings/FileText → Gauge/Camera/Settings/FileText); the header block is replaced by a compact all-in-one action strip (see below); the Console content branch is removed.

- [ ] **Step 1: Write the failing test**

`src/pages/instance-terminal.test.tsx` (adapts the wiring coverage from the old console tests):
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstanceTerminal } from "./instance-terminal";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  binaryType = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
}

vi.mock("xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    onData = vi.fn((cb: (d: string) => void) => { this._onData = cb; });
    onResize = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
    _onData: ((d: string) => void) | null = null;
  },
}));
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class { fit = vi.fn(); proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 })); },
}));
vi.mock("../api", () => ({
  instancesApi: {
    exec: vi.fn().mockResolvedValue({ type: "async", status_code: 100, operation: "/1.0/operations/op1", metadata: { metadata: { fds: { "0": "secret0", "control": "secretc" } } } }),
    console: vi.fn().mockResolvedValue({ type: "async", status_code: 100, operation: "/1.0/operations/op2", metadata: { metadata: { fds: { "0": "secretv" } } } }),
  },
}));

describe("InstanceTerminal", () => {
  beforeEach(() => { FakeWebSocket.instances = []; vi.stubGlobal("WebSocket", FakeWebSocket); });
  afterEach(() => vi.unstubAllGlobals());

  it("auto-connects a shell and wires binary io", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(2)); // data + control
    const data = FakeWebSocket.instances[0]!;
    expect(data.url).toContain("/1.0/operations/op1/websocket?secret=secret0");
    expect(data.binaryType).toBe("arraybuffer");
    data.onopen?.();
    const term = (await import("xterm")).Terminal as unknown as { mock: { instances: { _onData: ((d: string) => void) | null }[] } };
    // no-op placeholder — real assertions below use the module instance captured via the mock above
    expect(term).toBeDefined();
  });

  it("switches to VGA console via the toggle", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances.length).toBe(2));
    await user.click(screen.getByTestId("term-vga"));
    expect(instancesApi.console).toHaveBeenCalledWith("web1", 80, 24);
  });

  it("shows the instance name", () => {
    render(<InstanceTerminal instanceName="web1" />);
    expect(screen.getByText("web1")).toBeInTheDocument();
  });
});
```
NOTE: the xterm mock's `_onData` capture is awkward; simplify by keeping a module-level `let lastTerminal: { _onData: ((d: string) => void) | null } | null` that the mock assigns — adapt the test to that pattern and assert `send` received an ArrayBuffer after invoking `lastTerminal._onData("x")`, and `write` was called after `data.onmessage({ data: new Uint8Array([104, 105]) })`. The assertions above are the contract; make them pass with a clean mock.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/instance-terminal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement InstanceTerminal**

`src/pages/instance-terminal.tsx` — copy the protocol logic from `src/pages/instance/console.tsx` verbatim (connect/disconnect/cleanup/session guard/`toWsUrl`/encoders/exec+console/`sendResize`/`fitAndResize`/onopen/onmessage/onclose/onerror/onData/onResize), with these changes:
- Root: `<div className="flex h-screen flex-col" data-testid="instance-terminal">` with a slim header `<div className="flex h-9 items-center gap-2 border-b border-border bg-surface-900 px-3">` showing `<Terminal size={14} className="text-text-secondary" />` + `<span className="text-sm font-medium text-text-primary">{instanceName}</span>` + a right-aligned toggle: two small `Button size="sm" variant="ghost"` — `data-testid="term-shell"` (label "Shell", icon `SquareTerminal`) and `data-testid="term-vga"` (label "VGA", icon `Monitor`) — active kind gets `variant="secondary"`; disabled while `status === "connecting"`.
- Auto-connect: `useEffect(() => { void connect("exec"); return disconnect; }, [])` — run `connect("exec")` on mount (kind state `const [kind, setKind] = useState<"exec" | "console">("exec")`; the toggle handler sets kind then calls `connect(kind)`).
- Container: `<div ref={containerRef} className="min-h-0 flex-1 bg-surface-950" />` (terminal fills the viewport; xterm writes its own background from the theme `background: "#15181b"` — keep the Terminal theme as-is).
- Error line: `{status === "error" && <p className="px-3 pb-2 text-xs text-red-300" data-testid="term-error">Connection failed. Is the instance running?</p>}`
- Toasts stay (disconnect/error toasts are fine in the popup).
- The Terminal theme background update to the new palette: `theme: { background: "#191817" }`.

- [ ] **Step 4: Add the route and TerminalPage**

`src/App.tsx` — add a `TerminalPage` (same file or `src/pages/terminal-page.tsx`):
```tsx
function TerminalPage() {
  const { name = "" } = useParams();
  return <InstanceTerminal instanceName={name} />;
}
```
Route (OUTSIDE the Shell route, inside BrowserRouter — before the Shell block):
```tsx
<Routes>
  <Route path="terminal/:name" element={<TerminalPage />} />
  <Route element={<Shell />}>
    {/* existing routes unchanged */}
  </Route>
</Routes>
```

- [ ] **Step 5: Instance detail — action strip, remove Console tab**

`src/pages/instance-detail.tsx`:
- Imports: add `Play, Square, RotateCw, Trash2, Terminal as TerminalIcon, Eye, Gauge, Camera, Settings, FileText` from lucide-react; remove the `ConsoleTab` import.
- `tabs` array: remove the console entry (keep `{ key: "overview", label: "Overview", icon: <Gauge size={14} /> }`, `snapshots`/Camera, `config`/Settings, `logs`/FileText).
- Replace the header block (`<div className="flex items-center gap-3">…</div>` with the h1/status/actions) with the all-in-one strip:
```tsx
<div className="flex h-10 items-center gap-2 border-b border-border bg-surface-900 px-3" data-testid="instance-strip">
  <h1 className="truncate text-sm font-semibold text-text-primary">{instance.name}</h1>
  <InstanceStatusIcon status={instance.status} />
  <div className="ml-auto flex items-center gap-1.5">
    <Button size="sm" variant="ghost" data-testid="detail-action-start" disabled={instance.status === "Started" || instance.status === "Running"} onClick={() => setState("start")}><Play size={14} /> Start</Button>
    <Button size="sm" variant="ghost" data-testid="detail-action-stop" disabled={instance.status === "Stopped" || instance.status === "Error" || instance.status === "Stopping" || instance.status === "Freezing"} onClick={() => setState("stop")}><Square size={14} /> Stop</Button>
    <Button size="sm" variant="ghost" data-testid="detail-action-restart" disabled={instance.status !== "Started" && instance.status !== "Running"} onClick={() => setState("restart")}><RotateCw size={14} /> Restart</Button>
    <Button size="sm" variant="ghost" data-testid="detail-action-delete" onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</Button>
    <Button size="sm" variant="secondary" data-testid="detail-terminal" onClick={() => window.open(`/ui/terminal/${instance.name}`, `terminal-${instance.name}`, "width=1000,height=640")}><TerminalIcon size={14} /> Terminal</Button>
  </div>
</div>
```
- Remove the `{tab === "console" && <ConsoleTab instanceName={name} />}` branch.
- The page root keeps `flex h-full flex-col`; the tabs row `flex h-full min-h-0` + content area `min-w-0 flex-1 overflow-auto p-6` → content area becomes `min-w-0 flex-1 overflow-auto` (flush, no p-6).

- [ ] **Step 6: Delete ConsoleTab**

- `git rm src/pages/instance/console.tsx src/pages/instance/console.test.tsx`
- Grep for `console-tab`, `ConsoleTab`, `instance/console` — remove any remaining references.

- [ ] **Step 7: Update detail tests**

`src/pages/instance-detail.test.tsx`:
- The tab-switch test: `vtab-config` still valid; remove any `vtab-console` usage (none existed — the console tab was tested via `tab-console`? Check the file: the tests use `vtab-config`; the console tab wasn't directly tested beyond presence). Verify no test references `console-tab` (it's deleted).
- Add an assertion that the strip renders: `expect(screen.getByTestId("instance-strip")).toBeInTheDocument();` and that the Terminal button calls `window.open`:
```tsx
it("opens the terminal popup", async () => {
  const user = userEvent.setup();
  const openSpy = vi.fn();
  vi.stubGlobal("open", openSpy);
  render(<MemoryRouter initialEntries={["/instances/web1"]}><Routes><Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} /></Routes></MemoryRouter>);
  await screen.findByText("web1");
  await user.click(screen.getByTestId("detail-terminal"));
  expect(openSpy).toHaveBeenCalledWith("/ui/terminal/web1", "terminal-web1", "width=1000,height=640");
  vi.unstubAllGlobals();
});
```

- [ ] **Step 8: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass. (`vi.stubGlobal("open", …)` — `window.open` is `window.open`; stub `window.open` directly if the global stub doesn't intercept: `vi.spyOn(window, "open").mockImplementation(...)`.)

- [ ] **Step 9: Commit**

```bash
git add src/pages/instance-terminal.tsx src/pages/instance-terminal.test.tsx src/App.tsx src/pages/instance-detail.tsx src/pages/instance-detail.test.tsx src/pages/instance/console.tsx src/pages/instance/console.test.tsx
git commit -m "feat: terminal popup page and instance action strip"
```

---

### Task 3: Tree Hover Create + Member Target

**Files:**
- Modify: `src/components/tree.tsx`, `src/components/tree.test.tsx`, `src/shell/tree-model.tsx`, `src/shell/tree-model.test.ts`, `src/shell/sidebar.tsx`, `src/components/create-instance-wizard.tsx`, `src/components/create-instance-wizard.test.tsx`, `src/api/instances.ts`, `src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `CreateInstanceWizard` (existing), `instancesApi.create`
- Produces:
  - `TreeNode` gains `action?: ReactNode` (tree.tsx) — rendered right-aligned in the row, `opacity-0 group-hover:opacity-100`, click stops propagation; the row div gains `group`
  - `buildTree` params gain `onCreate?: (targetMember?: string) => void`; project node action = `+` button (`data-testid="tree-create-project"`, `Plus` icon size 13) calling `onCreate?.()`; member node action = `+` (`data-testid="tree-create-<name>"`) calling `onCreate?.(m.server_name)`; no action on instance nodes
  - `Sidebar` holds `const [wizardOpen, setWizardOpen] = useState(false); const [wizardTarget, setWizardTarget] = useState<string | undefined>(undefined);` — `onCreate={(target) => { setWizardTarget(target); setWizardOpen(true); }}` passed to `buildTree`; renders `<CreateInstanceWizard open={wizardOpen} onClose={() => setWizardOpen(false)} targetMember={wizardTarget} />`
  - `CreateInstanceWizard` gains `targetMember?: string` — stage-4 summary shows `<p><span className="text-text-tertiary">Target member:</span> {targetMember}</p>` when set; `instancesApi.create(body, targetMember)` passes it
  - `InstancesApi.create(body, target?: string)` — URL becomes `/instances${projectQuery()}${target ? `&target=${encodeURIComponent(target)}` : ""}`

- [ ] **Step 1: Tree action support (test first)**

`src/components/tree.test.tsx` — add:
```tsx
it("renders a hover action and stops propagation", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const onAction = vi.fn();
  render(<Tree nodes={[{ id: "n", label: "node", action: <button data-testid="node-action" onClick={onAction}>+</button> }]} onSelect={onSelect} />);
  expect(screen.getByTestId("node-action")).toBeInTheDocument();
  await user.click(screen.getByTestId("node-action"));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
});
```
Run to verify FAIL (no `action` on TreeNode type), then implement:

`src/components/tree.tsx`:
- `TreeNode` interface: add `action?: ReactNode;`
- `TreeNodeItem` row div: add `group` to className; after the badge span add:
```tsx
{node.action && (
  <span
    className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
    onClick={(e) => e.stopPropagation()}
  >
    {node.action}
  </span>
)}
```
(The badge span keeps `ml-auto` — if both badge and action exist they stack; in practice these nodes have no badge.)

- [ ] **Step 2: Tree model actions (test first)**

`src/shell/tree-model.test.ts` — update the first test to pass `onCreate` and assert actions:
```tsx
it("adds hover create actions to project and member nodes", () => {
  const onCreate = vi.fn();
  const tree = buildTree({ project: "default", members: [member("incus-1")], instancesByMember: { "incus-1": [] }, unassigned: [], onCreate });
  const projectNode = tree[1]!;
  expect(projectNode.action).toBeDefined();
  const memberNode = projectNode.children?.[0]!;
  expect(memberNode.action).toBeDefined();
  expect(projectNode.id).toBe("project-default");
  expect(memberNode.id).toBe("member-incus-1");
});
```
Run to verify FAIL, then implement in `src/shell/tree-model.tsx`:
- `TreeParams` gains `onCreate?: (targetMember?: string) => void;`
- Add a `createAction(testId: string, target?: string)` helper:
```tsx
const createAction = (testId: string, target?: string): ReactNode => (
  <button
    data-testid={testId}
    onClick={(e) => { e.stopPropagation(); onCreate?.(target); }}
    className="rounded p-0.5 text-text-tertiary hover:bg-surface-600 hover:text-text-primary"
    aria-label="Create instance"
  >
    <Plus size={13} />
  </button>
);
```
- Project node: `action: createAction("tree-create-project")`
- Member nodes: `action: createAction(\`tree-create-${m.server_name}\`, m.server_name)`
- Import `Plus` and `ReactNode`.

- [ ] **Step 3: API target param (test first)**

`src/api/endpoints.test.ts` — add:
```tsx
it("create appends target and keeps project", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, null));
  vi.stubGlobal("fetch", fetchMock);
  await instancesApi.create({ name: "web1", type: "container" }, "incus-1");
  expect(fetchMock.mock.calls[0]![0]).toBe("/1.0/instances?project=default&target=incus-1");
});
```
Run to verify FAIL, then implement in `src/api/instances.ts`:
```ts
create(body: CreateInstanceBody, target?: string): Promise<AsyncResponse | SyncResponse | null> {
  const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
  return this.client.post(`/instances${projectQuery()}${targetQuery}`, body);
}
```

- [ ] **Step 4: Wizard targetMember (test first)**

`src/components/create-instance-wizard.test.tsx` — add:
```tsx
it("passes the target member to create and shows it in the summary", async () => {
  const user = userEvent.setup();
  const { instancesApi } = await import("../api");
  render(<CreateInstanceWizard open onClose={() => {}} targetMember="incus-1" />);
  await screen.findByTestId("wizard-name");
  await user.type(screen.getByTestId("wizard-name"), "web1");
  await user.click(screen.getByTestId("wizard-next"));
  await screen.findByTestId("wizard-image-f1");
  await user.click(screen.getByTestId("wizard-image-f1"));
  await user.click(screen.getByTestId("wizard-next"));
  await user.click(screen.getByTestId("wizard-next"));
  expect(screen.getByText("Target member:")).toBeInTheDocument();
  await user.click(screen.getByTestId("wizard-create"));
  await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "web1" }), "incus-1"));
});
```
Run to verify FAIL, then implement in `src/components/create-instance-wizard.tsx`:
- Props: `export interface CreateInstanceWizardProps { open: boolean; onClose: () => void; targetMember?: string; }`
- `create()`: `instancesApi.create({ … }, targetMember)`.
- Stage 4 summary: add the target line after the Network line:
```tsx
{targetMember && <p><span className="text-text-tertiary">Target member:</span> {targetMember}</p>}
```
- Also add icons to the wizard's footer buttons (this task owns wizard edits): `Back` → `<ChevronLeft size={14} />`, `Next` → `<ChevronRight size={14} />`, `Create` → `<Check size={14} />`; and `Pull` → `<Download size={13} />`; `Pull from remote` toggle → `<RefreshCw size={13} />` (already has it). Import `ChevronLeft, ChevronRight, Check, Download`.

- [ ] **Step 5: Sidebar wiring**

`src/shell/sidebar.tsx`:
- Import `useState`, `CreateInstanceWizard`, `Plus` is not needed here.
- Add state + handler + wizard mount (see Interfaces). Pass `onCreate` into `buildTree`.

- [ ] **Step 6: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/tree.tsx src/components/tree.test.tsx src/shell/tree-model.tsx src/shell/tree-model.test.ts src/shell/sidebar.tsx src/components/create-instance-wizard.tsx src/components/create-instance-wizard.test.tsx src/api/instances.ts src/api/endpoints.test.ts
git commit -m "feat: tree hover create with member target"
```

---

### Task 4: Icons + Flush on Resource Pages

**Files:**
- Modify: `src/pages/images.tsx`, `src/pages/profiles.tsx`, `src/pages/networks.tsx`, `src/pages/storage.tsx`, `src/pages/projects.tsx`, `src/pages/member-view.tsx`, `src/pages/instance/snapshots.tsx`, `src/pages/instance/config.tsx`

**Interfaces:**
- Consumes: lucide-react
- Produces: every action button on these pages carries a lucide icon (size 14 before the label); page roots lose `p-6` (flush)

- [ ] **Step 1: Apply icons and flush per page**

For EACH page below, add the lucide import, wrap every action `Button`'s children with `<Icon size={14} /> ` before the label, and change the root `<div className="… p-6" data-testid="…">` to drop `p-6` (keep `space-y-4` where present):

- `src/pages/images.tsx`: root `p-6` → flush; `Pull image` (`Download`); pull dialog `Cancel` (`X`) + `Pull` (`Download`); row `Delete` (`Trash2`).
- `src/pages/profiles.tsx`: root `p-6` → flush; `Create profile` (`Plus`); dialog `Cancel` (`X`) + `Create` (`Plus`); edit dialog `Cancel` (`X`) + `Save` (`Check`); row `Edit` (`Pencil`) + `Delete` (`Trash2`).
- `src/pages/networks.tsx`: root `p-6` → flush; `Create network` (`Plus`); create dialog `Cancel` (`X`) + `Create` (`Plus`); edit dialog `Cancel` (`X`) + `Save` (`Check`); row `Edit` (`Pencil`) + `Delete` (`Trash2`).
- `src/pages/storage.tsx`: root `p-6` → flush; `Create pool` (`Plus`); dialog `Cancel` (`X`) + `Create` (`Plus`); row `Volumes` (`Database`) + `Delete` (`Trash2`); volume row `Delete` (`Trash2`).
- `src/pages/projects.tsx`: root `p-6` → flush; `Create project` (`Plus`); dialog `Cancel` (`X`) + `Create` (`Plus`); row `Set default` (`Star`) + `Delete` (`Trash2`).
- `src/pages/member-view.tsx`: header `px-6 py-3` → `px-4 py-2` (compact flush strip); no buttons.
- `src/pages/instance/snapshots.tsx`: root keeps `space-y-4` (already flush inside the detail content); `Create snapshot` (`Plus`); dialog `Cancel` (`X`) + `Create` (`Check`); row `Restore` (`RotateCcw`) + `Delete` (`Trash2`).
- `src/pages/instance/config.tsx`: `Save` (`Check`); `Reset` (`RotateCcw`).

Keep all `data-testid` values unchanged.

- [ ] **Step 2: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/images.tsx src/pages/profiles.tsx src/pages/networks.tsx src/pages/storage.tsx src/pages/projects.tsx src/pages/member-view.tsx src/pages/instance/snapshots.tsx src/pages/instance/config.tsx
git commit -m "feat: button icons and flush layout on resource pages"
```

---

### Task 5: Instances Table Icons + Overview Row Action

**Files:**
- Modify: `src/pages/instances.tsx`, `src/pages/instances.test.tsx`

**Interfaces:**
- Consumes: lucide-react
- Produces: toolbar + row action buttons carry icons; each row gains an Overview action (`Eye`, `data-testid="row-overview-<name>"`) navigating to `/instances/<name>`; root `p-6` removed

- [ ] **Step 1: Write the failing test**

`src/pages/instances.test.tsx` — add:
```tsx
it("navigates to overview from the row action", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/instances"]}>
      <Routes>
        <Route path="/instances" element={<InstancesPage />} />
        <Route path="/instances/:name" element={<div data-testid="detail-stub" />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText("web1");
  await user.click(screen.getByTestId("row-overview-web1"));
  expect(await screen.findByTestId("detail-stub")).toBeInTheDocument();
});
```
(The file's existing mock + helper are reused; the new Routes wrapper replaces the plain MemoryRouter in THIS test only.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/pages/instances.test.tsx`
Expected: FAIL — no `row-overview-web1`.

- [ ] **Step 3: Implement**

`src/pages/instances.tsx`:
- Imports: add `Play, Square, RotateCw, Snowflake, Trash2, Plus, Eye` from lucide-react.
- Root: `<div className="space-y-4 p-6" data-testid="instances-page">` → `<div className="space-y-4" data-testid="instances-page">`.
- Toolbar: `Start` (`Play`), `Stop` (`Square`), `Restart` (`RotateCw`), `Freeze` (`Snowflake`), `Delete` (`Trash2`), `Create instance` (`Plus`).
- Empty-state action: `Create instance` (`Plus`).
- Row actions column: `Start` (`Play`), `Stop` (`Square`) — and add before them:
```tsx
<Button size="sm" variant="ghost" data-testid={`row-overview-${i.name}`} onClick={() => navigate(`/instances/${i.name}`)} aria-label={`Overview ${i.name}`}><Eye size={14} /></Button>
```
(The row's `onRowClick` already navigates; the action makes it explicit and must stopPropagation via the existing wrapper div's `onClick={(e) => e.stopPropagation()}` — verify the actions column wrapper has it; add if missing.)

- [ ] **Step 4: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/instances.tsx src/pages/instances.test.tsx
git commit -m "feat: instance table icons and overview row action"
```

---

### Task 6: Task Log + Dialog + Gallery Icons, Final Verification

**Files:**
- Modify: `src/shell/task-log.tsx`, `src/components/confirm-dialog.tsx`, `src/pages/gallery.tsx`, `README.md` (mention popup terminal + tree create)
- Test: full gates + build + manual Playwright verification

**Interfaces:**
- Consumes: everything
- Produces: remaining icons; verified build and live behavior

- [ ] **Step 1: Task log icons**

`src/shell/task-log.tsx`: dismiss button (`X` size 12); "Clear finished" button (`Trash2` size 12 before label).

- [ ] **Step 2: ConfirmDialog icons**

`src/components/confirm-dialog.tsx`: `Cancel` → `<X size={14} /> Cancel`; `Confirm`/label button → `<Check size={14} /> {confirmLabel}`. (Both via children — the Button primitive takes children.)

- [ ] **Step 3: Gallery icons**

`src/pages/gallery.tsx`: give the action buttons icons — `Open dialog` (`Maximize2`), `Open confirm` (`ShieldAlert`), `Hover me` stays (tooltip demo), `Fire toast` (`Bell`), the wizard-ish `Create instance` in EmptyState (`Plus`). No test changes (gallery test asserts sections, not button children).

- [ ] **Step 4: README**

`README.md` — under the component-system/dev section, add: terminal opens in a browser popup at `/ui/terminal/<instance>` (shell + VGA toggle); the sidebar tree's `+` buttons create instances (member-targeted); config-key descriptions come from `GET /1.0/metadata` — enable on the server with `incus config set metadata.enabled true` (the UI shows "—" when unavailable).

- [ ] **Step 5: Full gates + build**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: all pass; `dist/` emits `/ui/assets/` links.

- [ ] **Step 6: Manual Playwright verification against the live cluster**

Run: `INCUS_TARGET=https://192.168.0.101:8443 npm run dev`, then in a browser:
1. `/ui/` — project overview is flush (no padding); tables span the full width; vertical tabs flush
2. Instance detail — the action strip shows name/status/actions/Terminal; tabs show Overview/Snapshots/Config/Logs (no Console tab)
3. Click Terminal — a popup opens at `/ui/terminal/<name>` with a live shell; toggle VGA on a VM; close the popup — main UI unaffected
4. Sidebar — hover a member node → `+` appears; click it → wizard opens with the member targeted (summary shows "Target member"); create a test container
5. Instance tables — `Eye` row action navigates to the detail Overview
6. Instance tables — `Eye` row action navigates to the detail Overview
7. Config tab — table editor: double-click a value to edit inline; select a row and use Edit; hover shows the pencil; Add/Remove work; Description column shows text (or "—" when the server has metadata disabled)

Expected: all flows work against the real cluster. Report what you observed honestly.

- [ ] **Step 7: Commit**

```bash
git add src/shell/task-log.tsx src/components/confirm-dialog.tsx src/pages/gallery.tsx README.md
git commit -m "feat: remaining button icons and docs, final verification"
```

---

### Task 7: Table-Style Config Editor (shared KeyValueEditor)

**Files:**
- Modify: `src/components/key-value-editor.tsx`, `src/components/key-value-editor.test.tsx`, `src/pages/instance/config.tsx`, `src/pages/profiles.tsx`, `src/api/server.ts`, `src/api/endpoints.test.ts`
- Modify: `README.md` (metadata.enabled note)

**Interfaces:**
- Consumes: existing `KeyValueEditor` consumers (ConfigTab, Profiles dialog), `ApiClient`
- Produces:
  - `ServerApi.metadata(): Promise<{ configs: { key: string; description: string }[] }>` in `src/api/server.ts` — `client.get("/metadata")` (GLOBAL, not project-scoped; 404 when the server lacks `metadata.enabled`)
  - `KeyValueEditor` gains `descriptions?: Record<string, string>` — third column "Description" (`text-xs text-text-tertiary`, value `descriptions?.[key] ?? "—"`)
  - Inline row-edit mode with three entry points: double-click value cell; select row + `kv-edit` button (enabled with selection); hover pencil `kv-edit-<key>`. Edit mode shows `kv-key-edit-<key>` / `kv-value-edit-<key>` inputs; Enter/blur commits, Esc cancels. Add (`kv-add`, `Plus`) appends a row; Remove (`kv-remove`, `Trash2`, enabled with selection) removes the selected row. Key-collision rename stays a no-op.
  - `ConfigTab` and the Profiles edit dialog fetch `serverApi.metadata()` on mount (best-effort, catch → empty map) and pass `descriptions`.

- [ ] **Step 1: Write the failing tests**

`src/components/key-value-editor.test.tsx` — add:
```tsx
it("edits a value inline on double-click", async () => {
  const user = userEvent.setup();
  render(<KeyValueEditor values={{ key1: "a" }} onChange={() => {}} />);
  await user.dblClick(screen.getByTestId("kv-value-key1"));
  const input = screen.getByTestId("kv-value-edit-key1");
  await user.clear(input);
  await user.type(input, "b");
  await user.keyboard("{Enter}");
  expect(screen.getByTestId("kv-value-key1")).toHaveTextContent("b");
});

it("edits key and value via select + Edit", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
  await user.click(screen.getByTestId("kv-row-key1"));
  expect(screen.getByTestId("kv-edit")).toBeEnabled();
  await user.click(screen.getByTestId("kv-edit"));
  const keyInput = screen.getByTestId("kv-key-edit-key1");
  const valueInput = screen.getByTestId("kv-value-edit-key1");
  await user.clear(keyInput);
  await user.type(keyInput, "key2");
  await user.clear(valueInput);
  await user.type(valueInput, "b");
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenLastCalledWith({ key2: "b" });
});

it("removes the selected row via the Remove button", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
  await user.click(screen.getByTestId("kv-row-key1"));
  await user.click(screen.getByTestId("kv-remove"));
  expect(onChange).toHaveBeenCalledWith({ key2: "b" });
});

it("renders descriptions from the prop with fallback", () => {
  render(<KeyValueEditor values={{ key1: "a", key2: "b" }} descriptions={{ key1: "Memory limit" }} onChange={() => {}} />);
  expect(screen.getByText("Memory limit")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});
```
NOTE: the existing tests assert old testids (`kv-key-<key>` / `kv-value-<key>` as INPUTS). In the new design those testids move to the TABLE CELLS (display mode) — update the existing "edits values"/"removes entries" tests accordingly (rename assertions to the new cells/inputs). The "adds entries" test's `kv-add` stays.

`src/api/endpoints.test.ts` — add:
```tsx
it("server metadata is not project-scoped", async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { configs: [{ key: "limits.memory", description: "Memory limit" }] }));
  vi.stubGlobal("fetch", fetchMock);
  await serverApi.metadata();
  expect(fetchMock).toHaveBeenCalledWith("/1.0/metadata", expect.anything());
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/components/key-value-editor.test.tsx src/api/endpoints.test.ts`
Expected: FAIL — no `metadata` method, no inline-edit testids.

- [ ] **Step 3: Implement the editor**

`src/components/key-value-editor.tsx` — rewrite the component:
- Props: `{ values: Record<string, string>; onChange: (values: Record<string, string>) => void; dataTestId?: string; descriptions?: Record<string, string> }`
- State: `const [selected, setSelected] = useState<string | null>(null);` and `const [editing, setEditing] = useState<string | null>(null);` (the row key currently in edit mode)
- Rows render as `<tr data-testid={`kv-row-${key}`} data-selected={selected === key} className={selected === key ? "bg-accent-600/10" : ""} onClick={() => { setSelected(key); }}>`:
  - Key cell: display `<td data-testid={`kv-key-${key}`} onDoubleClick={() => setEditing(key)} className="px-2 py-1 font-mono text-xs">`; when `editing === key`, an `<input data-testid={`kv-key-edit-${key}`}>` instead (onKeyDown Enter → commit, Escape → cancel; onBlur → commit)
  - Value cell: `<td data-testid={`kv-value-${key}`} onDoubleClick={() => setEditing(key)}>`; edit-mode `<input data-testid={`kv-value-edit-${key}`}>`
  - Description cell: `<td className="px-2 py-1 text-xs text-text-tertiary">{descriptions?.[key] ?? "—"}</td>`
  - Hover pencil: `<span className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setEditing(key); }}><button data-testid={`kv-edit-${key}`} aria-label={`Edit ${key}`}><Pencil size={13} /></button></span>` — the `<tr>` gains `group`
- Toolbar above the table: `Add` (`kv-add`, `Plus`, `Plus` icon) appends `custom_<n>`; `Edit` (`kv-edit`, `Pencil`, `disabled={!selected}`) → `setEditing(selected)`; `Remove` (`kv-remove`, `Trash2`, `disabled={!selected}`) → removes selected
- Commit/cancel helpers: `commitEdit(oldKey, newKey, newValue)` — applies key collision no-op rule (if newKey exists and differs from oldKey, keep oldKey), calls onChange; `cancelEdit()` → `setEditing(null)`
- Edit-mode inputs keep local draft state (`draftKey`/`draftValue`) initialized from the row on entering edit mode; Enter commits, Escape cancels and clears the row from edit mode.

- [ ] **Step 4: Metadata endpoint**

`src/api/server.ts`:
```ts
metadata(): Promise<{ configs: { key: string; description: string }[] }> {
  return this.client.get("/metadata");
}
```

- [ ] **Step 5: Wire consumers**

`src/pages/instance/config.tsx` — add state `const [descriptions, setDescriptions] = useState<Record<string, string>>({});` and in the existing load effect (or a second effect):
```tsx
useEffect(() => {
  void serverApi.metadata()
    .then((m) => {
      const map: Record<string, string> = {};
      for (const c of m.configs ?? []) if (c.key) map[c.key] = c.description;
      setDescriptions(map);
    })
    .catch(() => {});
}, []);
```
Pass `descriptions={descriptions}` to KeyValueEditor. Import `serverApi` from "../../api".

`src/pages/profiles.tsx` — same pattern in the edit-dialog flow: fetch metadata once on mount, pass `descriptions` to the KeyValueEditor in the edit dialog.

- [ ] **Step 6: Verify**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/key-value-editor.tsx src/components/key-value-editor.test.tsx src/pages/instance/config.tsx src/pages/profiles.tsx src/api/server.ts src/api/endpoints.test.ts README.md
git commit -m "feat: table-style config editor with descriptions and inline edit"
```
