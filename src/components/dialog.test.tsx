import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";
import { ConfirmDialog } from "./confirm-dialog";
import { Tooltip } from "./tooltip";

describe("Dialog", () => {
  it("does not render when closed", () => {
    render(<Dialog open={false} onClose={() => {}} title="T">x</Dialog>);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders content when open", () => {
    render(<Dialog open onClose={() => {}} title="Delete instance">Are you sure?</Dialog>);
    expect(screen.getByRole("dialog", { name: "Delete instance" })).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T">x</Dialog>);
    await user.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T">x</Dialog>);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Delete" body="Sure?" onConfirm={onConfirm} onCancel={() => {}} />);
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("Tooltip", () => {
  it("renders tooltip role", () => {
    render(<Tooltip label="help text"><button>?</button></Tooltip>);
    expect(screen.getByRole("tooltip")).toHaveTextContent("help text");
  });
});
