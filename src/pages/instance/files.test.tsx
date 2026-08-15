import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilesTab, joinPath, parentOf, basenameOf } from "./files";
import { filesApi } from "../../api";

vi.mock("../../api", () => ({
  filesApi: {
    read: vi.fn(),
    stat: vi.fn(),
    put: vi.fn(),
    create: vi.fn(),
    mkdir: vi.fn(),
    remove: vi.fn(),
    downloadUrl: (_instance: string, path: string) => `/1.0/instances/web1/files?path=${encodeURIComponent(path)}`,
  },
}));

describe("path helpers", () => {
  it("joins paths", () => {
    expect(joinPath("/", "etc")).toBe("/etc");
    expect(joinPath("/etc", "nginx")).toBe("/etc/nginx");
  });

  it("computes parents", () => {
    expect(parentOf("/etc/nginx/nginx.conf")).toBe("/etc/nginx");
    expect(parentOf("/etc")).toBe("/");
    expect(parentOf("/")).toBe("/");
  });

  it("computes basenames", () => {
    expect(basenameOf("/etc/nginx/nginx.conf")).toBe("nginx.conf");
    expect(basenameOf("/")).toBe("");
  });
});

describe("FilesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(filesApi.read).mockResolvedValue(["etc", "motd"]);
    vi.mocked(filesApi.stat).mockImplementation((_i, path) =>
      Promise.resolve(
        path.endsWith("/etc")
          ? { type: "directory", size: null, modified: "2025-01-01T00:00:00Z" }
          : { type: "file", size: 12, modified: "2025-01-02T00:00:00Z" }
      )
    );
  });

  const renderTab = () => render(<FilesTab instanceName="web1" project="default" />);

  it("lists entries with row actions", async () => {
    renderTab();
    expect(await screen.findByTestId("file-row-etc")).toBeInTheDocument();
    expect(screen.getByTestId("file-row-motd")).toBeInTheDocument();
    expect(screen.getByTestId("file-edit-motd")).toBeInTheDocument();
    expect(screen.getByTestId("file-download-motd")).toBeInTheDocument();
    expect(screen.getByTestId("files-cwd")).toHaveTextContent("/");
    expect(filesApi.read).toHaveBeenCalledWith("web1", "/", "default");
  });

  it("renders type icons from the stat sweep", async () => {
    renderTab();
    expect(await screen.findByTestId("entry-icon-etc")).toHaveAttribute("data-type", "directory");
    expect(screen.getByTestId("entry-icon-motd")).toHaveAttribute("data-type", "file");
    expect(filesApi.stat).toHaveBeenCalledWith("web1", "/etc", "default");
    expect(filesApi.stat).toHaveBeenCalledWith("web1", "/motd", "default");
  });

  it("hides edit and download actions for directories", async () => {
    renderTab();
    await screen.findByTestId("entry-icon-etc");
    expect(screen.queryByTestId("file-edit-etc")).not.toBeInTheDocument();
    expect(screen.queryByTestId("file-download-etc")).not.toBeInTheDocument();
    expect(screen.getByTestId("file-delete-etc")).toBeInTheDocument();
  });

  it("sorts directories before files", async () => {
    renderTab();
    await screen.findByTestId("files-table");
    const rows = screen.getAllByTestId("row");
    const names = rows.map((row) => row.querySelector("[data-testid^='file-row-']")?.textContent);
    expect(names).toEqual(["etc", "motd"]);
  });

  it("falls back to the unknown icon when stat fails", async () => {
    vi.mocked(filesApi.stat).mockRejectedValue(new Error("boom"));
    renderTab();
    expect(await screen.findByTestId("entry-icon-etc")).toHaveAttribute("data-type", "unknown");
    expect(screen.getByTestId("entry-icon-motd")).toHaveAttribute("data-type", "unknown");
  });

  it("shows size and modified from the stat sweep", async () => {
    renderTab();
    await screen.findByTestId("entry-icon-motd");
    expect(screen.getByText("12 B")).toBeInTheDocument();
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(screen.getByText("Directory")).toBeInTheDocument();
  });

  it("navigates into a directory", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc", "motd"] : ["nginx.conf"])
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    expect(await screen.findByTestId("file-row-nginx.conf")).toBeInTheDocument();
    expect(screen.getByTestId("files-cwd")).toHaveTextContent("/etc");
  });

  it("moves up to the parent directory", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : [])
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    await waitFor(() => expect(screen.getByTestId("files-cwd")).toHaveTextContent("/etc"));
    await user.click(screen.getByTestId("files-up"));
    await waitFor(() => expect(screen.getByTestId("files-cwd")).toHaveTextContent("/"));
  });

  it("opens a file in the editor and saves via put", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["motd"] : "hello")
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-motd"));
    await user.clear(await screen.findByTestId("file-content"));
    await user.type(screen.getByTestId("file-content"), "goodbye");
    await user.click(screen.getByTestId("file-save"));
    await waitFor(() => expect(filesApi.put).toHaveBeenCalledWith("web1", "/motd", "goodbye", "default"));
  });

  it("creates a new file via the dialog", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByTestId("files-new-file"));
    await user.type(screen.getByTestId("file-new-name"), "app.conf");
    await user.type(screen.getByTestId("file-content"), "listen 80;");
    await user.click(screen.getByTestId("file-save"));
    await waitFor(() => expect(filesApi.create).toHaveBeenCalledWith("web1", "/", "app.conf", "listen 80;", "default"));
  });

  it("requires a name for new files", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByTestId("files-new-file"));
    await user.click(screen.getByTestId("file-save"));
    expect(filesApi.create).not.toHaveBeenCalled();
  });

  it("creates a directory", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByTestId("files-new-dir"));
    await user.type(screen.getByTestId("mkdir-name"), "uploads");
    await user.click(screen.getByTestId("mkdir-submit"));
    await waitFor(() => expect(filesApi.mkdir).toHaveBeenCalledWith("web1", "/", "uploads", "default"));
  });

  it("deletes an entry after confirmation", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByTestId("file-delete-motd"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(filesApi.remove).toHaveBeenCalledWith("web1", "/motd", "default"));
  });

  it("downloads a file through the browser", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(["data"])) });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectUrl = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderTab();
    await user.click(await screen.findByTestId("file-download-motd"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/1.0/instances/web1/files?path=%2Fmotd", { credentials: "include" }));
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("uploads a file to the current directory", async () => {
    const user = userEvent.setup();
    renderTab();
    const file = new File(["binary"], "data.bin", { type: "application/octet-stream" });
    await user.upload(screen.getByTestId("files-upload-input"), file);
    await waitFor(() => expect(filesApi.create).toHaveBeenCalledWith("web1", "/", "data.bin", file, "default"));
  });
});
