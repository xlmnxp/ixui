import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperationsPage } from "./operations";
import { ApiError } from "../api/client";
import { operationsStore } from "../state/operations";

vi.mock("../api", () => ({
  operationsApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: "op1",
        class: "task",
        description: "Create instance web1",
        status: "Running",
        status_code: 103,
        created_at: "2026-08-12T10:00:00Z",
        updated_at: "2026-08-12T10:00:05Z",
        may_cancel: true,
      },
      {
        id: "op2",
        class: "task",
        description: "Delete instance old1",
        status: "Failure",
        status_code: 400,
        created_at: "2026-08-12T09:00:00Z",
        updated_at: "2026-08-12T09:00:01Z",
        may_cancel: false,
        err: "Instance is busy",
      },
    ]),
    cancel: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("OperationsPage", () => {
  afterEach(() => operationsStore.setState([]));

  it("lists operations with class, status, and error text", async () => {
    render(<OperationsPage />);
    expect(await screen.findByText("Create instance web1")).toBeInTheDocument();
    expect(screen.getAllByText("task")).toHaveLength(2);
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Failure")).toBeInTheDocument();
    expect(screen.getByText("Instance is busy")).toBeInTheDocument();
  });

  it("shows operations from the live event stream even when the list is empty", async () => {
    const { operationsApi } = await import("../api");
    vi.mocked(operationsApi.list).mockResolvedValueOnce([]);
    operationsStore.setState([
      {
        id: "op-live",
        class: "task",
        description: "Starting db1",
        status: "Running",
        status_code: 103,
        created_at: "2026-08-12T11:00:00Z",
        updated_at: "2026-08-12T11:00:00Z",
        may_cancel: false,
      },
    ]);
    render(<OperationsPage />);
    expect(await screen.findByText("Starting db1")).toBeInTheDocument();
  });

  it("cancels a cancellable operation", async () => {
    const user = userEvent.setup();
    const { operationsApi } = await import("../api");
    vi.mocked(operationsApi.list).mockClear();
    render(<OperationsPage />);
    await screen.findByText("Create instance web1");
    await user.click(screen.getByTestId("operation-cancel-op1"));
    await waitFor(() => expect(operationsApi.cancel).toHaveBeenCalledWith("op1"));
    await waitFor(() => expect(operationsApi.list).toHaveBeenCalledTimes(2));
  });

  it("does not offer cancel for non-cancellable operations", async () => {
    render(<OperationsPage />);
    await screen.findByText("Delete instance old1");
    expect(screen.queryByTestId("operation-cancel-op2")).not.toBeInTheDocument();
  });

  it("shows permission denied instead of crashing on 403", async () => {
    const { operationsApi } = await import("../api");
    vi.mocked(operationsApi.list).mockRejectedValueOnce(new ApiError(403, 403, "denied"));
    render(<OperationsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
  });
});
