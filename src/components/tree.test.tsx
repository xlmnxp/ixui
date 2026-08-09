import { render, screen } from "@testing-library/react";
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

  it("renders and expands", async () => {
    const user = userEvent.setup();
    render(<Tree nodes={nodes} />);
    expect(screen.getByTestId("tree-instances")).toBeInTheDocument();
    await user.click(screen.getByTestId("tree-project-default"));
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
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
