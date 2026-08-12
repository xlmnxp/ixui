import { useState } from "react";
import { Bell, Maximize2, Plus, ShieldAlert } from "lucide-react";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { StatusDot } from "../components/status-dot";
import { Spinner } from "../components/spinner";
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
        <Table
          columns={[
            { key: "name", header: "Name", sortValue: (r: { name: string }) => r.name, render: (r: { name: string }) => r.name },
            { key: "status", header: "Status", render: (r: { status: string }) => r.status },
          ]}
          rows={[{ name: "web1", status: "Started" }, { name: "db1", status: "Stopped" }]}
          rowKey={(r) => r.name}
        />
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
          <KeyValueEditor values={{ "limits.memory": "512MiB", "server.name": "ix" }} onChange={() => {}} />
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
