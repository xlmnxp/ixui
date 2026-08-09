import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateInstanceWizard } from "./create-instance-wizard";
import { toastStore } from "./toast";
import type { Operation } from "../api/types";

vi.mock("../api", () => ({
  instancesApi: {
    create: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "/1.0/operations/op1", metadata: null }),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ id: "op1", class: "task", description: "", status: "Success", status_code: 200, created_at: "t", updated_at: "t", may_cancel: false }) },
  infraApi: {
    listImages: vi.fn().mockResolvedValue([{ fingerprint: "f1", filename: "f1.img", description: "Ubuntu 24.04", public: true, created_at: "t", size: 100, type: "container", properties: {} }]),
    listProfiles: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {}, devices: {} }]),
    listNetworks: vi.fn().mockResolvedValue([{ name: "br0", description: "", type: "bridge", managed: true, used_by: [], status: "Created" }]),
    pullImage: vi.fn().mockResolvedValue(null),
  },
  api: { get: vi.fn() },
}));

describe("CreateInstanceWizard", () => {
  beforeEach(() => toastStore.setState([]));

  it("gates stage 1 on a valid name", async () => {
    const user = userEvent.setup();
    render(<CreateInstanceWizard open onClose={() => {}} />);
    await user.type(screen.getByTestId("wizard-name"), "bad name!");
    expect(screen.getByText("Name must contain only letters, numbers, and hyphens")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-next")).toBeDisabled();
    await user.clear(screen.getByTestId("wizard-name"));
    await user.type(screen.getByTestId("wizard-name"), "web1");
    expect(screen.getByTestId("wizard-next")).toBeEnabled();
  });

  it("walks through stages and creates the instance", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi, operationsApi } = await import("../api");
    render(<CreateInstanceWizard open onClose={onClose} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    expect(await screen.findByTestId("wizard-image-f1")).toBeInTheDocument();
    await user.click(screen.getByTestId("wizard-image-f1"));
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-next"));
    expect(screen.getByTestId("wizard-summary")).toHaveTextContent("web1");
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "web1", type: "container", source: expect.objectContaining({ fingerprint: "f1" }) })));
    expect(operationsApi.wait).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(instancesApi.create).mock.calls[0]![0]).not.toHaveProperty("project");
  });

  it("toasts an error and does not close when the async create fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi, operationsApi } = await import("../api");
    const failedOp: Operation = {
      id: "op1", class: "task", description: "", status: "Failure", status_code: 400,
      created_at: "", updated_at: "", may_cancel: false, err: "boom",
    };
    vi.mocked(operationsApi.wait).mockResolvedValueOnce(failedOp);
    render(<CreateInstanceWizard open onClose={onClose} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(await screen.findByTestId("wizard-image-f1"));
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalled());
    await waitFor(() => {
      const toasts = toastStore.getState();
      expect(toasts.some((t) => t.tone === "danger" && t.message === "boom")).toBe(true);
      expect(toasts.some((t) => t.tone === "success")).toBe(false);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets state when reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CreateInstanceWizard open onClose={() => {}} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    expect(await screen.findByTestId("wizard-image-f1")).toBeInTheDocument();
    rerender(<CreateInstanceWizard open={false} onClose={() => {}} />);
    expect(screen.queryByTestId("wizard-name")).not.toBeInTheDocument();
    rerender(<CreateInstanceWizard open onClose={() => {}} />);
    expect(screen.getByTestId("wizard-name")).toHaveValue("");
    expect(screen.getByText("Stage 1 of 4")).toBeInTheDocument();
    await act(async () => {});
  });

  it("keeps state when going back", async () => {
    const user = userEvent.setup();
    render(<CreateInstanceWizard open onClose={() => {}} />);
    await screen.findByTestId("wizard-name");
    await user.type(screen.getByTestId("wizard-name"), "web1");
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-back"));
    expect(screen.getByTestId("wizard-name")).toHaveValue("web1");
  });
});
