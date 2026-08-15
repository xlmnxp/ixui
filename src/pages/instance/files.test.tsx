import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilesTab, joinPath, parentOf, basenameOf } from "./files";
import { filesApi } from "../../api";

vi.mock("../../api", () => ({
  filesApi: {
    read: vi.fn(),
    put: vi.fn(),
    create: vi.fn(),
    mkdir: vi.fn(),
    remove: vi.fn(),
    downloadUrl: (_instance: string, path: string) => `/1.0/instances/web1/files?path=${encodeURIComponent(path)}`,
  },
}));

const entry = (name: string, type: "file" | "directory" | "symlink", size?: number) =>
  ({ name, type, size }) as import("../../api/files").FileEntry;

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
    vi.mocked(filesApi.read).mockResolvedValue([
      entry("etc", "directory"),
      entry("motd", "file", 12),
    ]);
  });

  const renderTab = () => render(<FilesTab instanceName="web1" project="default" />);

  it("lists entries with directories and file actions", async () => {
    renderTab();
    expect(await screen.findByTestId("file-row-etc")).toBeInTheDocument();
    expect(screen.getByTestId("file-row-motd")).toBeInTheDocument();
    expect(screen.getByTestId("file-edit-motd")).toBeInTheDocument();
    expect(screen.getByTestId("file-download-motd")).toBeInTheDocument();
    expect(screen.getByTestId("files-cwd")).toHaveTextContent("/");
    expect(filesApi.read).toHaveBeenCalledWith("web1", "/", "default");
  });

  it("navigates into a directory", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockResolvedValueOnce([
      entry("etc", "directory"),
      entry("motd", "file", 12),
    ]).mockResolvedValueOnce([entry("nginx.conf", "file", 100)]);
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    expect(await screen.findByTestId("file-row-nginx.conf")).toBeInTheDocument();
    expect(screen.getByTestId("files-cwd")).toHaveTextContent("/etc");
  });

  it("moves up to the parent directory", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockResolvedValue([entry("etc", "directory")]);
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    await waitFor(() => expect(screen.getByTestId("files-cwd")).toHaveTextContent("/etc"));
    await user.click(screen.getByTestId("files-up"));
    await waitFor(() => expect(screen.getByTestId("files-cwd")).toHaveTextContent("/"));
  });

  it("opens a file in the editor and saves via put", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockResolvedValueOnce([
      entry("motd", "file", 12),
    ]).mockResolvedValueOnce("hello");
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
