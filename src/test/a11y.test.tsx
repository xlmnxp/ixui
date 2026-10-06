import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Button } from "../components/button";
import { CommandPalette } from "../components/command-palette";
import { Dialog } from "../components/dialog";
import { Input } from "../components/input";
import { Table } from "../components/table";
import { Tabs } from "../components/tabs";
import { Tree } from "../components/tree";
import { VerticalTabs } from "../components/vertical-tabs";
import { Window } from "../components/window";
import { ConnectionBanner } from "../shell/connection-banner";
import { expectNoA11yViolations } from "./axe";

describe("accessibility (axe)", () => {
  it("actually detects violations", async () => {
    const { container } = render(<><img src="x.png" /><button /></>);
    await expect(expectNoA11yViolations(container)).rejects.toThrow();
  });

  it("tabs and vertical tabs", async () => {
    const tabs = [{ key: "a", label: "A" }, { key: "b", label: "B" }];
    const { container } = render(<><Tabs tabs={tabs} active="a" onChange={() => {}} /><VerticalTabs tabs={tabs} active="b" onChange={() => {}} /></>);
    await expectNoA11yViolations(container);
  });

  it("tree", async () => {
    const { container } = render(<Tree nodes={[{ id: "a", label: "A", children: [{ id: "a1", label: "A1" }] }, { id: "b", label: "B" }]} selectedId="a1" />);
    await expectNoA11yViolations(container);
  });

  it("table with selection", async () => {
    const { container } = render(
      <Table
        columns={[{ key: "n", header: "Name", sortValue: (r: { n: string }) => r.n, render: (r) => r.n }]}
        rows={[{ n: "web1" }, { n: "db1" }]}
        rowKey={(r) => r.n}
        selectedKeys={[]}
        onSelectionChange={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("form controls", async () => {
    const { container } = render(<form><Input label="Name" name="n" /><Button type="submit">Save</Button></form>);
    await expectNoA11yViolations(container);
  });

  it("dialog", async () => {
    render(<Dialog open onClose={() => {}} title="Title" footer={<Button>OK</Button>}><Input label="Field" name="f" /></Dialog>);
    await expectNoA11yViolations();
  });

  it("window", async () => {
    render(<Window open onClose={() => {}} title="Win"><p>body</p></Window>);
    await expectNoA11yViolations();
  });

  it("command palette", async () => {
    const run = () => {};
    render(<CommandPalette open onClose={() => {}} commands={[{ id: "a", group: "Go to", label: "Settings", icon: "settings", run }, { id: "b", group: "Instances", label: "web1", instance: { status: "Running", type: "container" }, run }]} />);
    await userEvent.type(screen.getByRole("combobox"), "s");
    await expectNoA11yViolations();
  });

  it("connection banner", async () => {
    const { container } = render(<MemoryRouter><ConnectionBanner /></MemoryRouter>);
    await expectNoA11yViolations(container);
  });
});
