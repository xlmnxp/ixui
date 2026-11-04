import { render, screen, waitFor } from "@testing-library/react";
import { OperationsPage } from "./operations";

const makeOp = (over: Record<string, unknown> = {}) => ({
  id: "op1",
  class: "task" as const,
  description: "Creating instance",
  status: "Running" as const,
  status_code: 103,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  may_cancel: false,
  ...over,
});

const list = vi.fn(async () => [
  makeOp({ metadata: { download_progress: "rootfs: 46% (7.76MB/s)" } }),
  makeOp({ id: "op2", description: "Copying instance" }),
  makeOp({ id: "op3", description: "Created", status: "Success", status_code: 200 }),
]);

vi.mock("../api", () => ({ operationsApi: { list: () => list(), cancel: vi.fn() } }));

describe("OperationsPage progress", () => {
  beforeEach(() => {
    list.mockClear();
    list.mockImplementation(async () => [
      makeOp({ metadata: { download_progress: "rootfs: 46% (7.76MB/s)" } }),
      makeOp({ id: "op2", description: "Copying instance" }),
      makeOp({ id: "op3", description: "Created", status: "Success", status_code: 200 }),
    ]);
  });

  it("shows the percentage, the stage text, and an indeterminate bar when there is no number", async () => {
    render(<OperationsPage />);
    const cell = await screen.findByTestId("operation-progress-op1");
    expect(cell).toHaveTextContent("46%");
    expect(cell.querySelector('[role="progressbar"]')).toHaveAttribute("aria-valuenow", "46");
    // The stage text is visible, not only a tooltip.
    expect(screen.getByTestId("operation-detail-op1")).toHaveTextContent("rootfs: 46% (7.76MB/s)");

    const noPercent = screen.getByTestId("operation-progress-op2");
    expect(noPercent).toHaveTextContent("…");
    expect(noPercent.querySelector('[role="progressbar"]')).not.toHaveAttribute("aria-valuenow");
    expect(screen.queryByTestId("operation-detail-op2")).not.toBeInTheDocument();

    // Finished work has no bar.
    expect(screen.queryByTestId("operation-progress-op3")).not.toBeInTheDocument();
  });

  it("polls while operations are running so the progress advances", async () => {
    render(<OperationsPage />);
    expect(await screen.findByTestId("operation-detail-op1")).toHaveTextContent("46%");
    list.mockImplementation(async () => [
      makeOp({ metadata: { download_progress: "rootfs: 82% (7.9MB/s)" } }),
    ]);
    // The page refreshes every 2s while something is running.
    await waitFor(
      () => expect(screen.getByTestId("operation-detail-op1")).toHaveTextContent("82%"),
      { timeout: 5_000 }
    );
  });
});
