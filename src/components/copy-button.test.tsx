import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CopyButton } from "./copy-button";
import { toastStore } from "./toast";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  toastStore.setState([]);
  writeText.mockClear();
  // user-event stubs the clipboard, so these tests click directly.
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("CopyButton", () => {
  it("copies the value and confirms with a toast", async () => {
    render(<CopyButton value="10.0.0.5" label="IP address" dataTestId="copy-ip" />);
    fireEvent.click(screen.getByTestId("copy-ip"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("10.0.0.5"));
    await waitFor(() =>
      expect(toastStore.getState().some((t) => t.tone === "success" && t.message === "IP address copied")).toBe(true)
    );
  });

  it("reports a failure instead of throwing", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    render(<CopyButton value="10.0.0.5" label="IP address" dataTestId="copy-ip" />);
    fireEvent.click(screen.getByTestId("copy-ip"));
    await waitFor(() => expect(toastStore.getState().some((t) => t.tone === "danger")).toBe(true));
  });
});
