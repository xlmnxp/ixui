import { useState } from "react";
import { Bell, FilePlus2, FolderPlus, Maximize2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { Spinner } from "../components/spinner";
import { Loading } from "../components/loading";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { Textarea } from "../components/textarea";
import { Checkbox } from "../components/checkbox";
import { Switch } from "../components/switch";
import { Dialog } from "../components/dialog";
import { ConfirmDialog } from "../components/confirm-dialog";
import { Tooltip } from "../components/tooltip";
import { Table } from "../components/table";
import { Tabs } from "../components/tabs";
import { Breadcrumbs } from "../components/breadcrumbs";
import { Progress } from "../components/progress";
import { Tree } from "../components/tree";
import { EmptyState } from "../components/empty-state";
import { SplitPane } from "../components/split-pane";
import { PageBar } from "../components/page-bar";
import { KeyValueEditor } from "../components/key-value-editor";
import { toast } from "../components/toast";
import { Window } from "../components/window";
import { VerticalTabs } from "../components/vertical-tabs";
import { ProjectDropdown } from "../components/project-dropdown";
import { InstanceIcon } from "../shell/instance-icon";
import { ExplorerNavbar } from "../components/explorer-nav";
import { FileEntryIcon } from "../components/file-entry-icon";
import { SnapshotSchedule } from "../components/snapshot-schedule";
import { parentOf } from "../lib/path";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface-900 p-4" data-testid="gallery-section">
      <h2 className="mb-3 text-sm font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function Gallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState("a");
  const [windowOpen, setWindowOpen] = useState(false);
  const [vtab, setVtab] = useState("a");
  const [kvValues, setKvValues] = useState<Record<string, string>>({ "limits.memory": "512MiB", "server.name": "ix" });
  const [kvSelected, setKvSelected] = useState<string[]>([]);
  const [explorerCwd, setExplorerCwd] = useState("/srv/www");
  const [explorerHistory, setExplorerHistory] = useState<string[]>(["/srv/www"]);
  const [explorerIndex, setExplorerIndex] = useState(0);
  const [ssEnabled, setSsEnabled] = useState(true);
  const [ssSchedule, setSsSchedule] = useState("");
  const [ssExpiry, setSsExpiry] = useState("");

  const explorerNavigate = (path: string) => {
    setExplorerCwd(path);
    setExplorerHistory((prev) => [...prev.slice(0, explorerIndex + 1), path]);
    setExplorerIndex((i) => i + 1);
  };
  const explorerGoBack = () => {
    if (explorerIndex <= 0) return;
    const idx = explorerIndex - 1;
    setExplorerIndex(idx);
    setExplorerCwd(explorerHistory[idx] ?? "/");
  };
  const explorerGoForward = () => {
    if (explorerIndex >= explorerHistory.length - 1) return;
    const idx = explorerIndex + 1;
    setExplorerIndex(idx);
    setExplorerCwd(explorerHistory[idx] ?? "/");
  };
  const explorerCommit = (path: string) => {
    if (path.includes("nope")) throw new Error(`Path not found: ${path}`);
    explorerNavigate(path);
  };

  return (
    <div className="space-y-4 p-6" data-testid="gallery">
      <h1 className="text-lg font-semibold text-text-primary">Component Gallery</h1>

      <Section title="Button">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button size="sm">Small</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </Section>

      <Section title="Badge">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
      </Section>

      <Section title="StatusDot">
        <StatusDot tone="success" label="Started" />
        <StatusDot tone="danger" label="Error" />
      </Section>

      <Section title="Spinner">
        <Spinner size="xs" />
        <Spinner size="sm" />
        <Spinner size="md" />
      </Section>

      <Section title="Loading">
        <Loading label="Loading instances…" />
        <div className="w-64 rounded border border-border">
          <Loading dataTestId="gallery-loading-bordered" label="Loading config…" />
        </div>
      </Section>

      <Section title="Form">
        <Input label="Name" placeholder="web1" />
        <Select label="Type" defaultValue="container">
          <option value="container">Container</option>
          <option value="virtual-machine">VM</option>
        </Select>
        <Textarea label="Notes" placeholder="Optional" />
        <Checkbox label="Ephemeral" />
        <Switch checked onChange={() => {}} label="Auto start" />
      </Section>

      <Section title="Overlay">
        <Button onClick={() => setDialogOpen(true)}><Maximize2 size={14} /> Open dialog</Button>
        <Button onClick={() => setConfirmOpen(true)}><ShieldAlert size={14} /> Open confirm</Button>
        <Tooltip label="Tooltip text"><Button>Hover me</Button></Tooltip>
      </Section>

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

      <Section title="FileEntryIcon">
        <span className="flex items-center gap-2"><FileEntryIcon type="directory" /> Directory</span>
        <span className="flex items-center gap-2"><FileEntryIcon type="file" /> File</span>
        <span className="flex items-center gap-2"><FileEntryIcon type="symlink" /> Symlink</span>
        <span className="flex items-center gap-2"><FileEntryIcon type={null} /> Unknown</span>
        <span className="flex items-center gap-2"><FileEntryIcon type="directory" size={18} /> size 18</span>
      </Section>

      <Section title="ExplorerNav">
        <div className="w-full">
          <div className="h-56 w-full overflow-auto rounded border border-border">
            <ExplorerNavbar
              cwd={explorerCwd}
              canBack={explorerIndex > 0}
              canForward={explorerIndex < explorerHistory.length - 1}
              onBack={explorerGoBack}
              onForward={explorerGoForward}
              onUp={() => explorerNavigate(parentOf(explorerCwd))}
              onNavigate={explorerNavigate}
              onCommitPath={explorerCommit}
              actions={
                <>
                  <Button size="sm" variant="ghost"><FilePlus2 size={14} /> New file</Button>
                  <Button size="sm" variant="ghost"><FolderPlus size={14} /> New folder</Button>
                </>
              }
            />
            <div className="p-3 text-xs text-text-secondary">
              <p className="mb-2">Click the breadcrumb bar to type a path. Paths containing "nope" demonstrate the inline error state. Scroll this box to see the bar stay pinned.</p>
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="border-b border-border py-1.5 font-mono">entry-{i}.log</div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Progress">
        <Progress value={45} />
        <Progress value={80} tone="success" />
        <Progress value={30} tone="danger" />
        <Progress size="md" />
      </Section>

      <Section title="Tabs">
        <Tabs tabs={[{ key: "a", label: "Tab A" }, { key: "b", label: "Tab B" }]} active={tab} onChange={setTab} />
      </Section>

      <Section title="Breadcrumbs">
        <Breadcrumbs items={[{ label: "Instances", to: "/instances" }, { label: "web1" }]} />
      </Section>

      <Section title="Table">
        <div className="h-48 w-full overflow-auto rounded border border-border">
          <Table
            columns={[
              { key: "name", header: "Name", sortValue: (r: { name: string }) => r.name, render: (r: { name: string }) => r.name },
              { key: "status", header: "Status", render: (r: { status: string }) => r.status },
            ]}
            rows={[
              { name: "web1", status: "Started" },
              { name: "db1", status: "Stopped" },
              { name: "cache1", status: "Started" },
              { name: "worker1", status: "Started" },
              { name: "worker2", status: "Stopped" },
              { name: "backup1", status: "Started" },
              { name: "staging1", status: "Stopped" },
              { name: "ci1", status: "Started" },
            ]}
            rowKey={(r) => r.name}
          />
        </div>
        <div className="h-48 w-full overflow-auto rounded border border-border">
          <div className="sticky top-0 z-10 flex h-8 items-center bg-surface-800 px-2 text-xs text-text-secondary">Demo bar (sticky, 32px) — header pins right below it</div>
          <Table
            stickyHeaderOffset={32}
            columns={[
              { key: "name", header: "Name", render: (r: { name: string }) => r.name },
              { key: "status", header: "Status", render: (r: { status: string }) => r.status },
            ]}
            rows={Array.from({ length: 10 }, (_, i) => ({ name: `entry-${i}`, status: "Ready" }))}
            rowKey={(r) => r.name}
          />
        </div>
      </Section>

      <Section title="Tree">
        <Tree
          nodes={[{ id: "p", label: "default", children: [{ id: "i", label: "Instances" }, { id: "im", label: "Images" }] }]}
        />
      </Section>

      <Section title="PageBar">
        <div className="w-full">
          <PageBar
            title="Instance action bar"
            actions={[
              <Button key="a" size="sm" variant="secondary"><Plus size={14} /> Add</Button>,
              <Button key="b" size="sm" variant="secondary">Save</Button>,
              <Button key="c" size="sm" variant="ghost">Cancel</Button>,
            ]}
          />
        </div>
      </Section>

      <Section title="SnapshotSchedule">
        <div className="w-full">
          <SnapshotSchedule
            schedule={ssSchedule}
            expiry={ssExpiry}
            enabled={ssEnabled}
            onScheduleChange={setSsSchedule}
            onExpiryChange={setSsExpiry}
            onEnabledChange={setSsEnabled}
            onSave={() => toast("success", "Saved (gallery demo)")}
          />
        </div>
      </Section>

      <Section title="EmptyState">
        <EmptyState title="No instances" description="Create your first instance." action={<Button size="sm"><Plus size={14} /> Create instance</Button>} />
      </Section>

      <Section title="SplitPane">
        <div className="h-40 w-full">
          <SplitPane left={<div className="p-2">left</div>} right={<div className="p-2">right</div>} />
        </div>
        <div className="h-40 w-full">
          <SplitPane vertical left={<div className="p-2">top</div>} right={<div className="p-2">bottom</div>} />
        </div>
      </Section>

      <Section title="KeyValueEditor">
        <div className="w-full">
          <KeyValueEditor
            values={kvValues}
            onChange={setKvValues}
            selectedKeys={kvSelected}
            onSelectionChange={setKvSelected}
          />
        </div>
        <div className="w-full rounded border border-border p-2">
          <p className="mb-2 text-[11px] text-text-tertiary">Nested editor (bordered, toolbar hidden) — as used inside the devices table.</p>
          <KeyValueEditor
            values={{ nictype: "bridged", parent: "br0" }}
            onChange={() => {}}
            dataTestId="gallery-kv-bordered"
            showToolbar={false}
            bordered
          />
        </div>
      </Section>

      <Section title="Toast">
        <Button onClick={() => toast("success", "Toast works")}><Bell size={14} /> Fire toast</Button>
      </Section>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Dialog">Dialog body.</Dialog>
      <ConfirmDialog open={confirmOpen} title="Confirm" body="Are you sure?" onConfirm={() => setConfirmOpen(false)} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}
