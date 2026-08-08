import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toastStore, toast, dismissToast, Toaster } from "./toast";

describe("toast", () => {
  beforeEach(() => toastStore.setState([]));

  it("pushes a toast", () => {
    toast("success", "Instance created");
    expect(toastStore.getState()).toHaveLength(1);
    expect(toastStore.getState()[0]?.message).toBe("Instance created");
  });

  it("auto-dismisses after 4s", () => {
    vi.useFakeTimers();
    toast("info", "hello");
    act(() => vi.advanceTimersByTime(4000));
    expect(toastStore.getState()).toHaveLength(0);
    vi.useRealTimers();
  });

  it("dismisses manually", () => {
    toast("info", "hello");
    const id = toastStore.getState()[0]!.id;
    dismissToast(id);
    expect(toastStore.getState()).toHaveLength(0);
  });

  it("renders toasts with close buttons", async () => {
    const user = userEvent.setup();
    toast("warning", "Disk low");
    render(<Toaster />);
    expect(screen.getByText("Disk low")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Disk low")).not.toBeInTheDocument();
  });
});
