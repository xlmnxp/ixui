import { render, screen } from "@testing-library/react";
import { TaskLog } from "./task-log";
import { operationsStore } from "../state/operations";
import type { Operation } from "../api/types";

vi.mock("../api", () => ({ operationsApi: { cancel: vi.fn() } }));

const op = (over: Partial<Operation>): Operation => ({
  id: "op1",
  class: "task",
  description: "Downloading image",
  status: "Running",
  status_code: 103,
  created_at: "",
  updated_at: "",
  may_cancel: false,
  ...over,
});

describe("TaskLog progress", () => {
  afterEach(() => operationsStore.setState([]));

  it("renders the download percentage for running operations", () => {
    operationsStore.setState([op({ id: "op1", metadata: { download_progress: "37%" } })]);
    render(<TaskLog collapsed={false} onToggle={() => {}} />);
    const cell = screen.getByTestId("tasklog-progress-op1");
    expect(cell).toHaveTextContent("37%");
    expect(cell.querySelector('[role="progressbar"]')).toHaveAttribute("aria-valuenow", "37");
  });

  it("shows what the operation is doing, e.g. the rootfs download", () => {
    operationsStore.setState([
      op({ id: "op1", description: "Creating instance", metadata: { download_progress: "rootfs: 46% (7.76MB/s)" } }),
    ]);
    render(<TaskLog collapsed={false} onToggle={() => {}} />);
    expect(screen.getByTestId("tasklog-detail-op1")).toHaveTextContent("rootfs: 46% (7.76MB/s)");
    expect(screen.getByTestId("tasklog-progress-op1")).toHaveTextContent("46%");
  });

  it("falls back to an indeterminate bar without a percentage", () => {
    operationsStore.setState([op({ id: "op2", description: "Starting web1" })]);
    render(<TaskLog collapsed={false} onToggle={() => {}} />);
    const cell = screen.getByTestId("tasklog-progress-op2");
    expect(cell.querySelector('[role="progressbar"]')).not.toHaveAttribute("aria-valuenow");
    expect(cell).not.toHaveTextContent("%");
  });

  it("shows the active percentage in the collapsed bar", () => {
    operationsStore.setState([
      op({ id: "op1", metadata: { download_progress: "12%" } }),
      op({ id: "op2", metadata: { download_progress: "64%" } }),
    ]);
    render(<TaskLog collapsed onToggle={() => {}} />);
    expect(screen.getByTestId("task-log")).toHaveTextContent("Operations (2) · 64%");
  });
});
