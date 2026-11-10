import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./dialog";

function Harness({ dirty, onClose }: { dirty: boolean; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit volume"
      dirty={dirty}
      discardMessage="Discard volume edits?"
      renderFooter={(close) => (
        <button data-testid="cancel" onClick={close}>
          Cancel
        </button>
      )}
    >
      <input aria-label="value" />
    </Dialog>
  );
}

describe("Dialog unsaved changes guard", () => {
  it("closes without asking when nothing changed", () => {
    const onClose = vi.fn();
    render(<Harness dirty={false} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard volume edits?")).not.toBeInTheDocument();
  });

  it("asks before discarding through the backdrop, Escape or the footer", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness dirty onClose={onClose} />);

    fireEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard volume edits?")).toBeInTheDocument();
    // Keep editing.
    await user.click(screen.getByTestId("confirm-cancel"));
    expect(screen.queryByText("Discard volume edits?")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Escape path asks as well.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByText("Discard volume edits?")).toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-confirm"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("routes the footer cancel through the same guard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness dirty onClose={onClose} />);
    await user.click(screen.getByTestId("cancel"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Discard volume edits?")).toBeInTheDocument();
  });
});
