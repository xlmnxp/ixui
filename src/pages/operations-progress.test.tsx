import { render, screen } from "@testing-library/react";
import { OperationsPage } from "./operations";

const running = (id: string, metadata?: Record<string, unknown>) => ({
  id,
  class: "task" as const,
  description: "Downloading image",
  status: "Running" as const,
  status_code: 103,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  may_cancel: false,
  metadata,
});

vi.mock("../api", () => ({
  operationsApi: {
    list: vi.fn(async () => [
      { id: "op1", class: "task", description: "Downloading image", status: "Running", status_code: 103, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", may_cancel: false, metadata: { download_progress: "42%" } },
      { id: "op2", class: "task", description: "Copying instance", status: "Running", status_code: 103, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", may_cancel: false },
      { id: "op3", class: "task", description: "Created", status: "Success", status_code: 200, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", may_cancel: false },
    ]),
    cancel: vi.fn(),
  },
}));

describe("OperationsPage progress", () => {
  it("shows download percentage, an indeterminate bar, and no bar for finished work", async () => {
    render(<OperationsPage />);
    const withPercent = await screen.findByTestId("operation-progress-op1");
    expect(withPercent).toHaveTextContent("42%");
    expect(withPercent.querySelector('[role="progressbar"]')).toHaveAttribute("aria-valuenow", "42");

    const withoutPercent = screen.getByTestId("operation-progress-op2");
    expect(withoutPercent).toHaveTextContent("…");
    expect(withoutPercent.querySelector('[role="progressbar"]')).not.toHaveAttribute("aria-valuenow");

    expect(screen.queryByTestId("operation-progress-op3")).not.toBeInTheDocument();
  });
});

void running;
