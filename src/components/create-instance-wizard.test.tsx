import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateInstanceWizard } from "./create-instance-wizard";

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
