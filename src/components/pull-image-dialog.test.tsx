import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PullImageDialog } from "./pull-image-dialog";
import { infraApi } from "../api";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";
import type { SimplestreamsCatalog } from "../api/simplestreams";

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
    "ubuntu-24.04-default-amd64": { os: "ubuntu", release: "24.04", version: "1", variant: "default", arch: "amd64", itemTypes: ["squashfs"], size: 1, path: "u", fingerprints: ["a"] },
    "alpine-3.22-default-amd64": { os: "alpine", release: "3.22", version: "1", variant: "default", arch: "amd64", itemTypes: ["squashfs"], size: 1, path: "a", fingerprints: ["b"] },
  },
};

describe("PullImageDialog", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.clearAllMocks();
    const { loadCatalog } = await import("../lib/image-prefill");
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
  });

  it("searches the catalog, picks an image, reviews, and pulls it", async () => {
    const user = userEvent.setup();
    const onPulled = vi.fn();
    const onClose = vi.fn();
    render(<PullImageDialog open onClose={onClose} onPulled={onPulled} />);
    expect(screen.getByTestId("step-next")).toBeDisabled();
    await screen.findByTestId("picker-row-ubuntu/24.04/default/amd64");
    await user.type(screen.getByTestId("picker-search"), "alp");
    expect(screen.queryByTestId("picker-row-ubuntu/24.04/default/amd64")).toBeNull();
    await user.click(await screen.findByTestId("picker-row-alpine/3.22/default/amd64"));
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByTestId("review-list")).toHaveTextContent(SIMPLE_STREAMS_DEFAULT);
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() =>
      expect(infraApi.pullImage).toHaveBeenCalledWith({ alias: expect.stringContaining("alpine"), server: SIMPLE_STREAMS_DEFAULT, protocol: "simplestreams" }),
    );
    expect(onPulled).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("does not show the picker's own inline pull form", async () => {
    render(<PullImageDialog open onClose={() => {}} onPulled={() => {}} />);
    await screen.findByTestId("picker-row-ubuntu/24.04/default/amd64");
    expect(screen.queryByTestId("wizard-pull-toggle")).toBeNull();
  });

  it("supports entering an OCI image manually", async () => {
    const user = userEvent.setup();
    render(<PullImageDialog open onClose={() => {}} onPulled={() => {}} />);
    await user.click(screen.getByTestId("pull-mode-manual"));
    expect(screen.getByTestId("step-next")).toBeDisabled();
    await user.type(screen.getByTestId("pull-alias"), "nginx:latest");
    await user.clear(screen.getByTestId("pull-server"));
    await user.type(screen.getByTestId("pull-server"), "https://docker.io");
    await user.selectOptions(screen.getByTestId("pull-protocol"), "oci");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-submit"));
    await waitFor(() => expect(infraApi.pullImage).toHaveBeenCalledWith({ alias: "nginx:latest", server: "https://docker.io", protocol: "oci" }));
  });
});
