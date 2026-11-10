import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Window } from "./window";

function Harness({ dirty, onClose }: { dirty: boolean; onClose: () => void }) {
  return (
    <Window open onClose={onClose} title="Volume data" dirty={dirty} renderFooter={(close) => (
      <button data-testid="w-cancel" onClick={close}>Close</button>
    )}>
      <p>body</p>
    </Window>
  );
}

describe("Window unsaved changes guard", () => {
  it("closes straight away when clean", () => {
    const onClose = vi.fn();
    render(<Harness dirty={false} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("window-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks before discarding dirty edits", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness dirty onClose={onClose} />);

    fireEvent.click(screen.getByTestId("window-close"));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("You have unsaved changes. Discard them?")).toBeInTheDocument();

    await user.click(screen.getByTestId("confirm-confirm"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // The footer runs through the same guard.
    onClose.mockClear();
    await user.click(screen.getByTestId("w-cancel"));
    expect(screen.getByText("You have unsaved changes. Discard them?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
