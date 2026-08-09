import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsoleTab } from "./console";

const terminalState = vi.hoisted(() => ({
  onDataHandlers: [] as ((data: string) => void)[],
  writes: [] as string[],
  disposes: 0,
}));

const apiMocks = vi.hoisted(() => ({
  exec: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  toast: vi.fn(),
}));

vi.mock("xterm", () => ({
  Terminal: class {
    loadAddon = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    onData = vi.fn((handler: (data: string) => void) => {
      terminalState.onDataHandlers.push(handler);
    });
    onResize = vi.fn();
    write = vi.fn((data: string) => {
      terminalState.writes.push(data);
    });
    dispose = vi.fn(() => {
      terminalState.disposes++;
    });
  },
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
    proposeDimensions = vi.fn(() => ({ cols: 100, rows: 30 }));
  },
}));

vi.mock("../../api", () => ({
  instancesApi: {
    exec: apiMocks.exec,
    console: vi.fn(),
  },
}));

vi.mock("../../components/toast", () => ({
  toast: toastMock.toast,
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

function makeExecResponse() {
  return {
    type: "async",
    status: "Running",
    status_code: 100,
    operation: "/1.0/operations/op1",
    metadata: {
      id: "op1",
      status: "Running",
      status_code: 103,
      may_cancel: true,
      metadata: { fds: { "0": "secret0", "control": "secretc" } },
    },
  };
}

describe("ConsoleTab", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    terminalState.onDataHandlers = [];
    terminalState.writes = [];
    terminalState.disposes = 0;
    apiMocks.exec.mockReset();
    apiMocks.exec.mockResolvedValue(makeExecResponse());
    toastMock.toast.mockReset();
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders connect buttons", () => {
    render(<ConsoleTab instanceName="web1" />);
    expect(screen.getByTestId("console-exec")).toBeInTheDocument();
    expect(screen.getByTestId("console-vga")).toBeInTheDocument();
    expect(screen.getByTestId("console-disconnect")).toBeInTheDocument();
  });

  it("connects the exec websockets and wires terminal I/O", async () => {
    render(<ConsoleTab instanceName="web1" />);
    fireEvent.click(screen.getByTestId("console-exec"));

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));

    const dataSocket = FakeWebSocket.instances[0]!;
    const controlSocket = FakeWebSocket.instances[1]!;
    expect(dataSocket.url).toBe(`ws://${window.location.host}/1.0/operations/op1/websocket?secret=secret0`);
    expect(controlSocket.url).toBe(`ws://${window.location.host}/1.0/operations/op1/websocket?secret=secretc`);
    expect(dataSocket.binaryType).toBe("arraybuffer");

    dataSocket.readyState = FakeWebSocket.OPEN;
    act(() => dataSocket.onopen?.());
    expect(controlSocket.send).not.toHaveBeenCalled();

    controlSocket.readyState = FakeWebSocket.OPEN;
    act(() => controlSocket.onopen?.());
    expect(controlSocket.send).toHaveBeenCalledTimes(1);
    expect(controlSocket.send.mock.calls[0]![0]).toBe(
      JSON.stringify({ command: "window-resize", args: { width: "100", height: "30" } })
    );
    expect(screen.queryByTestId("console-error")).not.toBeInTheDocument();

    terminalState.onDataHandlers[0]?.("ls -la");
    expect(dataSocket.send).toHaveBeenCalledTimes(1);
    const sent = dataSocket.send.mock.calls[0]![0];
    expect(typeof sent).not.toBe("string");
    expect(ArrayBuffer.isView(sent)).toBe(true);
    expect(new TextDecoder().decode(sent as ArrayBuffer)).toBe("ls -la");

    act(() => dataSocket.onmessage?.({ data: new TextEncoder().encode("hello").buffer }));
    expect(terminalState.writes).toContain("hello");
    act(() => dataSocket.onmessage?.({ data: "plain text" }));
    expect(terminalState.writes).toContain("plain text");
  });

  it("closes the previous session before starting a new one", async () => {
    render(<ConsoleTab instanceName="web1" />);
    fireEvent.click(screen.getByTestId("console-exec"));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));

    const firstDataSocket = FakeWebSocket.instances[0]!;
    firstDataSocket.readyState = FakeWebSocket.OPEN;
    act(() => firstDataSocket.onopen?.());

    fireEvent.click(screen.getByTestId("console-exec"));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(4));

    expect(FakeWebSocket.instances[0]!.close).toHaveBeenCalled();
    expect(FakeWebSocket.instances[1]!.close).toHaveBeenCalled();
    expect(apiMocks.exec).toHaveBeenCalledTimes(2);
  });

  it("disposes the terminal and keeps the error visible on websocket error", async () => {
    render(<ConsoleTab instanceName="web1" />);
    fireEvent.click(screen.getByTestId("console-exec"));
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));

    const dataSocket = FakeWebSocket.instances[0]!;
    act(() => dataSocket.onerror?.());

    expect(screen.getByTestId("console-error")).toBeInTheDocument();
    expect(terminalState.disposes).toBe(1);
    expect(toastMock.toast).toHaveBeenCalledWith("danger", "Console connection failed");

    act(() => dataSocket.onclose?.());
    expect(screen.getByTestId("console-error")).toBeInTheDocument();
    expect(toastMock.toast).not.toHaveBeenCalledWith("info", "Console disconnected");
  });
});
