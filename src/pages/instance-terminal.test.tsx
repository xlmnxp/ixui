import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstanceTerminal } from "./instance-terminal";

const terminalState = vi.hoisted(() => ({
  lastTerminal: null as unknown as {
    _onData: ((d: string) => void) | null;
    write: ReturnType<typeof vi.fn>;
  } | null,
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
    onResize = vi.fn();
    write = vi.fn();
    dispose = vi.fn();
    _onData: ((d: string) => void) | null = null;
    constructor() {
      terminalState.lastTerminal = this;
    }
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 80, rows: 24 }));
  },
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
    metadata: { metadata: { fds: { "0": "secretv" } } },
  };
}

describe("InstanceTerminal", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    terminalState.lastTerminal = null;
    apiMocks.exec.mockReset();
    apiMocks.console.mockReset();
    apiMocks.exec.mockResolvedValue(execResponse());
    apiMocks.console.mockResolvedValue(consoleResponse());
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auto-connects a shell and wires binary io", async () => {
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
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

  it("switches to VGA console via the toggle", async () => {
    const user = userEvent.setup();
    render(<InstanceTerminal instanceName="web1" />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    const data = FakeWebSocket.instances[0]!;
    data.readyState = FakeWebSocket.OPEN;
    act(() => data.onopen?.());
    await user.click(screen.getByTestId("term-vga"));
    expect(apiMocks.console).toHaveBeenCalledWith("web1", 80, 24);
  });

  it("shows the instance name", () => {
    render(<InstanceTerminal instanceName="web1" />);
    expect(screen.getByText("web1")).toBeInTheDocument();
  });
});
