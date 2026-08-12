import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateInstanceWizard } from "./create-instance-wizard";
import { toastStore } from "./toast";
import type { Operation } from "../api/types";
import type { SimplestreamsCatalog } from "../api/simplestreams";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";

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

vi.mock("../lib/image-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/image-prefill")>();
  return { ...actual, loadCatalog: vi.fn().mockResolvedValue(null) };
});

const CATALOG: SimplestreamsCatalog = {
  products: {
    "ubuntu-24.04-default-amd64": {
      os: "ubuntu", release: "24.04", version: "v1", variant: "default", arch: "amd64",
      itemTypes: ["squashfs"], size: 100, path: "u", fingerprints: ["f1"],
    },
    "ubuntu-24.04-cloud-amd64": {
      os: "ubuntu", release: "24.04", version: "v1", variant: "cloud", arch: "amd64",
      itemTypes: ["squashfs"], size: 200, path: "u", fingerprints: ["f2"],
    },
  },
};

async function goToStage2(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId("wizard-name");
  await user.type(screen.getByTestId("wizard-name"), "web1");
  await user.click(screen.getByTestId("wizard-next"));
}

async function goToStage4(user: ReturnType<typeof userEvent.setup>) {
  await goToStage2(user);
  await user.click(await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64"));
  await user.click(screen.getByTestId("wizard-next"));
  await user.click(screen.getByTestId("wizard-next"));
}

describe("CreateInstanceWizard", () => {
  beforeEach(async () => {
    toastStore.setState([]);
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockReset();
    vi.mocked(loadCatalog).mockResolvedValue(null);
  });

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

  it("creates from a remote image alias without pre-pulling", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi, operationsApi } = await import("../api");
    render(<CreateInstanceWizard open onClose={onClose} />);
    await goToStage4(user);
    expect(screen.getByTestId("wizard-summary")).toHaveTextContent("web1");
    expect(screen.getByTestId("wizard-summary")).toHaveTextContent("ubuntu/24.04/cloud/amd64");
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      name: "web1",
      type: "container",
      source: { type: "image", server: SIMPLE_STREAMS_DEFAULT, protocol: "simplestreams", alias: "ubuntu/24.04/cloud/amd64" },
    }), undefined));
    expect(operationsApi.wait).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(vi.mocked(instancesApi.create).mock.calls[0]![0]).not.toHaveProperty("project");
  });

  it("creates from a cached local fingerprint when the image is cached", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    render(<CreateInstanceWizard open onClose={() => {}} />);
    await goToStage2(user);
    await user.click(await screen.findByTestId("picker-row-ubuntu/24.04/default/amd64"));
    expect(screen.getByTestId("picker-cached-ubuntu/24.04/default/amd64")).toBeInTheDocument();
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-next"));
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({
      source: { type: "image", fingerprint: "f1" },
    }), undefined));
  });

  it("passes the target member to create and shows it in the summary", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(<CreateInstanceWizard open onClose={() => {}} targetMember="incus-1" />);
    await goToStage4(user);
    expect(screen.getByText("Target member:")).toBeInTheDocument();
    await user.click(screen.getByTestId("wizard-create"));
    await waitFor(() => expect(instancesApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "web1" }), "incus-1"));
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
    await goToStage4(user);
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
    await goToStage4(user);
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
