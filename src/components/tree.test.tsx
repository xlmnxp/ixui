import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tree } from "./tree";
import { EmptyState } from "./empty-state";
import { SplitPane } from "./split-pane";

describe("Tree", () => {
  const nodes = [
    {
      id: "project-default",
      label: "default",
      children: [
        { id: "instances", label: "Instances", badge: <span>3</span> },
        { id: "images", label: "Images" },
      ],
    },
  ];

  it("clicking a row opens closed parents but never collapses", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} />);
    expect(screen.getByTestId("tree-instances")).toBeInTheDocument();
    expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
    // Clicking an open row keeps the subtree open...
    await user.click(screen.getByTestId("tree-project-default"));
    expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
    // The toggle button collapses...
    await user.click(screen.getByTestId("tree-toggle-project-default"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    // ...and clicking the row opens it again (one-way).
    await user.click(screen.getByTestId("tree-project-default"));
    expect(screen.getAllByRole("group").length).toBeGreaterThan(0);
  });

  it("calls onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Tree nodes={nodes} onSelect={onSelect} />);
    await user.click(screen.getByTestId("tree-instances"));
    expect(onSelect).toHaveBeenCalledWith("instances");
  });

  it("collapses everything, including roots, with initialExpanded=false", () => {
    render(<Tree nodes={nodes} initialExpanded={false} />);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tree-instances")).not.toBeInTheDocument();
  });

  it("fires a node's onContextMenu on right-click", () => {
    const onContextMenu = vi.fn();
    render(<Tree nodes={[{ id: "n", label: "node", onContextMenu }]} />);
    fireEvent.contextMenu(screen.getByTestId("tree-n"));
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

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
});

describe("EmptyState", () => {
  it("renders title and action", () => {
    render(<EmptyState title="No instances" action={<button>Create</button>} />);
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No instances");
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });
});

describe("SplitPane", () => {
  it("renders both panes", () => {
    render(<SplitPane left={<div>left</div>} right={<div>right</div>} />);
    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    expect(screen.getByTestId("split-handle")).toBeInTheDocument();
  });
});
