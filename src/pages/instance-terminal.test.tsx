import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toastStore } from "../components/toast";
import { InstanceTerminal } from "./instance-terminal";

const terminalState = vi.hoisted(() => ({
  lastTerminal: null as unknown as {
    _onData: ((d: string) => void) | null;
    _onTitleChange: ((title: string) => void) | null;
    write: ReturnType<typeof vi.fn>;
  } | null,
  terminals: [] as unknown[],
  disposes: 0,
}));

const apiMocks = vi.hoisted(() => ({
  exec: vi.fn(),
  console: vi.fn(),
}));

vi.mock("xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    onData = vi.fn((cb: (d: string) => void) => {
      this._onData = cb;
    });
    onTitleChange = vi.fn((cb: (title: string) => void) => {
      this._onTitleChange = cb;
    });
    onResize = vi.fn();
    write = vi.fn();
    dispose = vi.fn(() => {
      terminalState.disposes++;
    });
    _onData: ((d: string) => void) | null = null;
    _onTitleChange: ((title: string) => void) | null = null;
    constructor() {
      terminalState.lastTerminal = this;
      terminalState.terminals.push(this);
    }
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  },
}));

vi.mock("../../lib/spice/src/main.js", () => ({
  SpiceMainConn: class {
    stop = vi.fn();
    constructor(_opts: unknown) {}
  },
  handle_resize: vi.fn(),
}));

vi.mock("../api", () => ({
  instancesApi: {
    exec: apiMocks.exec,
    console: apiMocks.console,
  },
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  url: string;
  binaryType = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((msg: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
}

function execResponse() {
  return {
    type: "async",
    status_code: 100,
    operation: "/1.0/operations/op1",
    metadata: { metadata: { fds: { "0": "secret0", control: "secretc" } } },
  };
}

function consoleResponse() {
  return {
    type: "async",
    status_code: 100,
    operation: "/1.0/operations/op2",
    metadata: { metadata: { fds: { "0": "secretv", control: "secretvc" } } },
  };
}

describe("InstanceTerminal", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/ui/terminal/web1");
    FakeWebSocket.instances = [];
    terminalState.lastTerminal = null;
    terminalState.terminals = [];
    terminalState.disposes = 0;
    apiMocks.exec.mockReset();
    apiMocks.console.mockReset();
    apiMocks.exec.mockResolvedValue(execResponse());
    apiMocks.console.mockResolvedValue(consoleResponse());
    toastStore.setState([]);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-connects a shell with bash by default and wires binary io", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(apiMocks.exec).toHaveBeenCalledTimes(1);
    expect(apiMocks.exec).toHaveBeenCalledWith("web1", ["/bin/bash"], true);
    const data = FakeWebSocket.instances[0]!;
    expect(data.url).toContain("/1.0/operations/op1/websocket?secret=secret0");
    expect(data.binaryType).toBe("arraybuffer");
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    const term = terminalState.lastTerminal!;
    act(() => term._onData?.("x"));
    expect(data.send).toHaveBeenCalledTimes(1);
    const sent = data.send.mock.calls[0]![0];
    expect(ArrayBuffer.isView(sent)).toBe(true);
    expect(new TextDecoder().decode(sent as ArrayBuffer)).toBe("x");
    act(() => data.onmessage?.({ data: new Uint8Array([104, 105]) }));
    expect(term.write).toHaveBeenCalledWith("hi");
  });

  it("closes the previous session and disposes its terminal before reconnecting", async () => {
    const user = userEvent.setup();
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const firstData = FakeWebSocket.instances[0]!;
    const firstControl = FakeWebSocket.instances[1]!;
    firstData.readyState = FakeWebSocket.OPEN;
    act(() => firstData.onopen?.());
    // The shell dies without producing output: fail fast, then switch via the error state.
    act(() => firstData.onclose?.());
    await screen.findByTestId("term-error");
    await user.click(screen.getByTestId("term-switch"));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(3));
    expect(firstData.close).toHaveBeenCalled();
    expect(firstControl.close).toHaveBeenCalled();
    expect(apiMocks.console).toHaveBeenCalledWith("web1", 80, 24);
    const firstTerminal = terminalState.terminals[0] as { dispose: ReturnType<typeof vi.fn> };
    expect(firstTerminal.dispose).toHaveBeenCalled();
  });

  it("falls back to sh when bash fails", async () => {
    apiMocks.exec
      .mockRejectedValueOnce(new Error("no bash"))
      .mockResolvedValueOnce(execResponse());
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(apiMocks.exec).toHaveBeenCalledTimes(2);
    expect(apiMocks.exec).toHaveBeenNthCalledWith(1, "web1", ["/bin/bash"], true);
    expect(apiMocks.exec).toHaveBeenNthCalledWith(2, "web1", ["/bin/sh"], true);
  });

  it("shows the error placeholder when the websocket closes before connecting", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    // The server closes the socket without it ever opening.
    act(() => data.onclose?.());
    expect(screen.getByTestId("term-error")).toBeInTheDocument();
    expect(screen.getByText("Shell unavailable")).toBeInTheDocument();
  });

  it("shows the placeholder instead of Console disconnected when no data ever arrives", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    // The websocket opens, but the server closes it without a single byte of
    // shell output (e.g. a VM without a running agent).
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    act(() => data.onclose?.());
    expect(screen.getByTestId("term-error")).toBeInTheDocument();
    expect(screen.getByText("Shell unavailable")).toBeInTheDocument();
    const toasts = toastStore.getState();
    expect(toasts.some((t) => t.message === "Console disconnected")).toBe(false);
  });

  it("keeps the clean disconnect behavior after a session produced data", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    act(() => data.onmessage?.({ data: new Uint8Array([112, 114, 111, 109, 112, 116]) }));
    act(() => data.onclose?.());
    expect(screen.queryByTestId("term-error")).not.toBeInTheDocument();
    const toasts = toastStore.getState();
    expect(toasts.some((t) => t.message === "Console disconnected")).toBe(true);
  });

  it("shows the error placeholder when the connection times out", async () => {
    vi.useFakeTimers();
    render(<InstanceTerminal instanceName="web1" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(FakeWebSocket.instances).toHaveLength(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByTestId("term-error")).toBeInTheDocument();
    expect(screen.getByText("Shell unavailable")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows the shell error placeholder with a danger toast when both shells fail", async () => {
    apiMocks.exec.mockRejectedValue(new Error("boom"));
    render(<InstanceTerminal instanceName="web1" />);
    expect(await screen.findByTestId("term-error")).toBeInTheDocument();
    expect(screen.getByText("Shell unavailable")).toBeInTheDocument();
    expect(screen.getByText(/instance is running/)).toBeInTheDocument();
    expect(screen.getByTestId("term-retry")).toBeInTheDocument();
    expect(screen.getByTestId("term-switch")).toHaveTextContent("Switch to Console");
    // Both shell candidates were attempted.
    expect(apiMocks.exec).toHaveBeenCalledTimes(2);
    const toasts = toastStore.getState();
    expect(toasts.some((t) => t.tone === "danger" && t.message === "boom")).toBe(true);
  });

  it("offers to switch to VGA from the shell error state", async () => {
    const user = userEvent.setup();
    apiMocks.exec.mockRejectedValue(new Error("boom"));
    render(<InstanceTerminal instanceName="web1" />);
    await screen.findByTestId("term-error");
    await user.click(screen.getByTestId("term-switch"));
    expect(apiMocks.console).toHaveBeenCalledWith("web1", 80, 24);
  });

  it("shows the VGA error placeholder and offers to switch to Shell", async () => {
    const user = userEvent.setup();
    apiMocks.console.mockRejectedValue(new Error("vga down"));
    window.history.replaceState({}, "", "/ui/terminal/web1?project=default&mode=vga");
    render(<InstanceTerminal instanceName="web1" />);
    expect(await screen.findByText("Console unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("term-switch")).toHaveTextContent("Switch to Shell");
    await user.click(screen.getByTestId("term-switch"));
    expect(apiMocks.exec).toHaveBeenCalledWith("web1", ["/bin/bash"], true);
  });

  it("flushes the latest window-resize over the control socket on open", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    const control = FakeWebSocket.instances[1]!;
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    expect(control.send).not.toHaveBeenCalled();
    control.readyState = FakeWebSocket.OPEN;
    act(() => control.onopen?.());
    expect(control.send).toHaveBeenCalledTimes(1);
    expect(control.send.mock.calls[0]![0]).toBe(
      JSON.stringify({ command: "window-resize", args: { width: "80", height: "24" } })
    );
  });

  it("hides the bar and the console/terminal toggle buttons", () => {
    render(<InstanceTerminal instanceName="web1" />);
    expect(screen.getByTestId("instance-terminal")).toBeInTheDocument();
    expect(screen.queryByText("web1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("term-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("term-vga")).not.toBeInTheDocument();
  });

  it("adds, switches, and closes shell tabs", async () => {
    const user = userEvent.setup();
    render(<InstanceTerminal instanceName="web1" />);
    await screen.findByTestId("term-tab-t0");
    await waitFor(() => expect(screen.getByTestId("term-tab-t0")).toHaveTextContent("web1 : bash"));
    await user.click(screen.getByTestId("term-tab-add"));
    const tab1 = await screen.findByTestId("term-tab-t1");
    await waitFor(() => expect(tab1).toHaveTextContent("web1 : bash"));
    // Both shell sessions connect (data + control websockets each).
    await waitFor(() => expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(4));
    await user.click(screen.getByTestId("term-tab-close-t1"));
    expect(screen.queryByTestId("term-tab-t1")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("term-tab-t0"));
    expect(screen.getByTestId("term-tab-t0")).toBeInTheDocument();
  });

  it("updates the tab label from the terminal title", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    act(() => terminalState.lastTerminal!._onTitleChange?.("htop"));
    expect(await screen.findByText("htop")).toBeInTheDocument();
  });

  it("renames a tab and sets its color via double-click", async () => {
    const user = userEvent.setup();
    render(<InstanceTerminal instanceName="web1" />);
    const tab = await screen.findByTestId("term-tab-t0");
    await user.dblClick(tab);
    const nameInput = await screen.findByTestId("term-tab-name");
    await user.clear(nameInput);
    await user.type(nameInput, "prod shell");
    await user.click(screen.getByTestId("term-tab-color-#d29922"));
    await user.click(screen.getByTestId("term-tab-rename-save"));
    expect(screen.getByTestId("term-tab-t0")).toHaveTextContent("prod shell");
    expect((screen.getByTestId("term-tab-t0") as HTMLElement).style.backgroundColor).toContain("rgba");
  });

  it("starts in VGA mode when the URL requests it", async () => {
    window.history.replaceState({}, "", "/ui/terminal/web1?project=default&mode=vga");
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(apiMocks.console).toHaveBeenCalledWith("web1", 80, 24));
    expect(apiMocks.exec).not.toHaveBeenCalled();
    window.history.replaceState({}, "", "/");
  });

  it("refits and resizes the shell when the window resizes", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    const control = FakeWebSocket.instances[1]!;
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    control.readyState = FakeWebSocket.OPEN;
    act(() => control.onopen?.());
    expect(control.send).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(control.send).toHaveBeenCalledTimes(2);
    expect(control.send.mock.calls[1]![0]).toBe(
      JSON.stringify({ command: "window-resize", args: { width: "80", height: "24" } })
    );
  });
});
