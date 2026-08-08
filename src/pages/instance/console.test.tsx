import { render, screen } from "@testing-library/react";
import { ConsoleTab } from "./console";

vi.mock("xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    onData = vi.fn();
    onResize = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class { fit = vi.fn(); },
}));

vi.mock("../../api", () => ({
  instancesApi: {
    exec: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "/1.0/operations/op1", metadata: { id: "op1", status: "Running", status_code: 103, may_cancel: true, metadata: { fds: { "0": "secret0", "control": "secretc" } } } }),
    console: vi.fn(),
  },
}));

describe("ConsoleTab", () => {
  it("renders connect buttons", () => {
    render(<ConsoleTab instanceName="web1" />);
    expect(screen.getByTestId("console-exec")).toBeInTheDocument();
    expect(screen.getByTestId("console-vga")).toBeInTheDocument();
    expect(screen.getByTestId("console-disconnect")).toBeInTheDocument();
  });
});
