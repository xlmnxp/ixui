import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagesPage } from "./images";

vi.mock("../api", () => ({
  infraApi: {
    listImages: vi.fn().mockResolvedValue([
      { fingerprint: "abcdef1234567890", filename: "x.img", description: "Ubuntu 24.04", public: true, created_at: "2026-01-01T00:00:00Z", size: 104857600, type: "container", properties: {} },
      { fingerprint: "1234567890abcdef", filename: "y.img", description: "Debian 13", public: true, created_at: "2026-01-02T00:00:00Z", size: 209715200, type: "container", properties: {} },
    ]),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    pullImage: vi.fn().mockResolvedValue(null),
    listAliases: vi.fn().mockResolvedValue([
      { name: "ubuntu/24.04", description: "Ubuntu 24.04", target: "ubuntu-24.04-default-amd64", type: "image" },
    ]),
    createAlias: vi.fn().mockResolvedValue(null),
    deleteAlias: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("ImagesPage", () => {
  beforeEach(async () => {
    const { infraApi } = await import("../api");
    vi.mocked(infraApi.listAliases).mockReset();
    vi.mocked(infraApi.createAlias).mockReset();
    vi.mocked(infraApi.deleteAlias).mockReset();
    vi.mocked(infraApi.listAliases).mockResolvedValue([
      { name: "ubuntu/24.04", description: "Ubuntu 24.04", target: "ubuntu-24.04-default-amd64", type: "image" },
    ]);
    vi.mocked(infraApi.createAlias).mockResolvedValue(null);
    vi.mocked(infraApi.deleteAlias).mockResolvedValue(undefined);
  });

  it("lists images", async () => {
    render(<ImagesPage />);
    expect(await screen.findByText("Ubuntu 24.04")).toBeInTheDocument();
    expect(screen.getByText("abcdef123456")).toBeInTheDocument();
    expect(screen.getByText("100 MiB")).toBeInTheDocument();
  });

  it("pulls an image", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("pull-open"));
    await user.type(screen.getByTestId("pull-alias"), "ubuntu/24.04");
    await user.clear(screen.getByTestId("pull-server"));
    await user.type(screen.getByTestId("pull-server"), "https://images.linuxcontainers.org");
    await user.click(screen.getByTestId("pull-submit"));
    await waitFor(() => expect(infraApi.pullImage).toHaveBeenCalledWith(expect.objectContaining({ alias: "ubuntu/24.04", server: "https://images.linuxcontainers.org" })));
  });

  it("deletes with confirmation", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("image-delete-abcdef1234567890"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteImage).toHaveBeenCalledWith("abcdef1234567890"));
  });

  it("bulk deletes selected images", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    const checkboxes = screen.getAllByTestId("row-select");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    await user.click(screen.getByTestId("action-delete"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteImage).toHaveBeenCalledWith("abcdef1234567890"));
    await waitFor(() => expect(infraApi.deleteImage).toHaveBeenCalledWith("1234567890abcdef"));
  });

  it("lists aliases when the section is opened", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("aliases-open"));
    expect(await screen.findByTestId("aliases-section")).toBeInTheDocument();
    expect(screen.getByText("ubuntu/24.04")).toBeInTheDocument();
    expect(screen.getByText("ubuntu-24.04-default-amd64")).toBeInTheDocument();
    await user.click(screen.getByTestId("aliases-open"));
    expect(screen.queryByTestId("aliases-section")).not.toBeInTheDocument();
    expect(infraApi.listAliases).toHaveBeenCalled();
  });

  it("creates an alias", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("aliases-open"));
    await screen.findByTestId("aliases-section");
    await user.click(screen.getByTestId("alias-create-open"));
    await user.type(screen.getByTestId("alias-name"), "ubuntu/22.04");
    await user.type(screen.getByTestId("alias-target"), "ubuntu-22.04-default-amd64");
    await user.click(screen.getByTestId("alias-create-submit"));
    await waitFor(() => expect(infraApi.createAlias).toHaveBeenCalledWith({ name: "ubuntu/22.04", target: "ubuntu-22.04-default-amd64" }));
    await waitFor(() => expect(screen.queryByTestId("dialog")).not.toBeInTheDocument());
  });

  it("deletes an alias with confirmation", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ImagesPage />);
    await screen.findByText("Ubuntu 24.04");
    await user.click(screen.getByTestId("aliases-open"));
    await user.click(await screen.findByTestId("alias-delete-ubuntu/24.04"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteAlias).toHaveBeenCalledWith("ubuntu/24.04"));
  });
});
