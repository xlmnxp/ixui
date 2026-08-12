import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagePicker } from "./image-picker";
import type { PickedImage } from "./image-picker";
import { toastStore } from "./toast";
import type { SimplestreamsCatalog } from "../api/simplestreams";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";

vi.mock("../api", () => ({
  infraApi: {
    listImages: vi.fn().mockResolvedValue([]),
    pullImage: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../lib/image-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/image-prefill")>();
  return { ...actual, loadCatalog: vi.fn() };
});

const CATALOG: SimplestreamsCatalog = {
  products: {
    "ubuntu-24.04-default-amd64": {
      os: "ubuntu", release: "24.04", version: "20260709_07:42", variant: "default", arch: "amd64",
      itemTypes: ["squashfs", "qcow2"], size: 200000000, path: "u", fingerprints: ["local-fp-1"],
    },
    "ubuntu-24.04-cloud-amd64": {
      os: "ubuntu", release: "24.04", version: "20260709_07:42", variant: "cloud", arch: "amd64",
      itemTypes: ["squashfs", "qcow2"], size: 250000000, path: "u", fingerprints: ["cloud-fp"],
    },
    "alpine-3.22-default-amd64": {
      os: "alpine", release: "3.22", version: "20260701", variant: "default", arch: "amd64",
      itemTypes: ["squashfs"], size: 3000000, path: "a", fingerprints: ["alpine-fp"],
    },
  },
};

function renderPicker(props: Partial<Parameters<typeof ImagePicker>[0]> = {}) {
  const onSelect = vi.fn();
  const utils = render(
    <ImagePicker type="container" cloudInitEnabled={false} onSelect={onSelect} {...props} />
  );
  return { onSelect, ...utils };
}

describe("ImagePicker", () => {
  beforeEach(async () => {
    localStorage.clear();
    toastStore.setState([]);
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockReset();
    const { infraApi } = await import("../api");
    vi.mocked(infraApi.listImages).mockReset();
    vi.mocked(infraApi.listImages).mockResolvedValue([]);
  });

  it("renders catalog rows with size and build info", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    renderPicker();
    const row = await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64");
    expect(row).toHaveTextContent("238.4 MiB");
    expect(row).toHaveTextContent("20260709_07:42");
    expect(screen.getByTestId("picker-row-alpine/3.22/default/amd64")).toBeInTheDocument();
  });

  it("falls back to the bundled list when the catalog fails", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(null);
    renderPicker();
    expect(await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64")).toBeInTheDocument();
    expect(screen.getByText("Offline — showing bundled image list.")).toBeInTheDocument();
    expect(screen.getByTestId("picker-row-nixos/25.05/cloud/amd64")).toBeInTheDocument();
  });

  it("filters rows by search", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    renderPicker();
    await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64");
    await userEvent.type(screen.getByTestId("picker-search"), "alpine");
    expect(screen.getByTestId("picker-row-alpine/3.22/default/amd64")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-row-ubuntu/24.04/cloud/amd64")).not.toBeInTheDocument();
    await userEvent.clear(screen.getByTestId("picker-search"));
    await userEvent.type(screen.getByTestId("picker-search"), "ubuntu");
    expect(screen.queryByTestId("picker-row-alpine/3.22/default/amd64")).not.toBeInTheDocument();
    expect(screen.getByTestId("picker-row-ubuntu/24.04/default/amd64")).toBeInTheDocument();
  });

  it("selects a row and reports the picked image", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    const { onSelect } = renderPicker();
    await userEvent.click(await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64"));
    expect(onSelect).toHaveBeenCalledWith({
      server: SIMPLE_STREAMS_DEFAULT,
      alias: "ubuntu/24.04/cloud/amd64",
      protocol: "simplestreams",
    });
  });

  it("prefers the cloud variant with a warning when cloud-init is enabled", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    const { onSelect } = renderPicker({ cloudInitEnabled: true });
    await userEvent.click(await screen.findByTestId("picker-row-ubuntu/24.04/default/amd64"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ alias: "ubuntu/24.04/cloud/amd64" }));
    await waitFor(() => {
      expect(toastStore.getState().some((t) => t.tone === "warning" && t.message.includes("cloud variant"))).toBe(true);
    });
  });

  it("shows the cached badge and reports the local fingerprint", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    const { infraApi } = await import("../api");
    vi.mocked(infraApi.listImages).mockResolvedValue([
      { fingerprint: "local-fp-1", filename: "x.img", description: "Ubuntu 24.04", public: true, created_at: "t", size: 1, type: "container", properties: {} },
    ]);
    const { onSelect } = renderPicker();
    await screen.findByTestId("picker-row-ubuntu/24.04/default/amd64");
    await waitFor(() => {
      expect(screen.getByTestId("picker-cached-ubuntu/24.04/default/amd64")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId("picker-row-ubuntu/24.04/default/amd64"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ fingerprint: "local-fp-1", alias: "ubuntu/24.04/default/amd64" }));
  });

  it("supports OCI images against docker.io", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    const { onSelect } = renderPicker();
    await userEvent.click(screen.getByTestId("picker-oci"));
    await userEvent.type(screen.getByTestId("oci-image"), "nginx:latest");
    await userEvent.click(screen.getByTestId("oci-use"));
    const picked: PickedImage = onSelect.mock.calls[0]?.[0] ?? null;
    expect(picked).toEqual({ server: "docker.io", alias: "nginx:latest", protocol: "oci" });
  });

  it("manages custom remotes and reloads the catalog on switch", async () => {
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(null);
    renderPicker();
    await screen.findByTestId("picker-row-ubuntu/24.04/cloud/amd64");
    expect(screen.getByTestId("picker-remote")).toHaveValue(SIMPLE_STREAMS_DEFAULT);

    await userEvent.click(screen.getByTestId("picker-remote-manage"));
    await userEvent.type(screen.getByTestId("picker-remote-add"), "https://images.example.com");
    await userEvent.click(screen.getByTestId("picker-remote-save"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    await userEvent.selectOptions(screen.getByTestId("picker-remote"), "https://images.example.com");
    expect(vi.mocked(loadCatalog)).toHaveBeenCalledWith("https://images.example.com");

    await userEvent.click(screen.getByTestId("picker-remote-manage"));
    await userEvent.click(screen.getByTestId("picker-remote-remove-1"));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("option", { name: "https://images.example.com" })).not.toBeInTheDocument();
  });
});
