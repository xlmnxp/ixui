import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilesTab, joinPath, parentOf, basenameOf, normalizeTypedPath } from "./files";
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

  it("normalizes typed paths", () => {
    expect(normalizeTypedPath("/etc")).toBe("/etc");
    expect(normalizeTypedPath("etc/nginx")).toBe("/etc/nginx");
    expect(normalizeTypedPath("/etc/")).toBe("/etc");
    expect(normalizeTypedPath("\\etc\\nginx")).toBe("/etc/nginx");
    expect(normalizeTypedPath("//etc///nginx/")).toBe("/etc/nginx");
    expect(normalizeTypedPath("")).toBe("/");
    expect(normalizeTypedPath("   ")).toBe("/");
    expect(normalizeTypedPath("/")).toBe("/");
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
    expect(screen.getByTestId("crumb-root")).toHaveTextContent("/");
    expect(screen.getByTestId("files-back")).toBeDisabled();
    expect(screen.getByTestId("files-forward")).toBeDisabled();
    expect(filesApi.read).toHaveBeenCalledWith("web1", "/", "default");
  });

  it("keeps the navigation bar sticky at the top", async () => {
    renderTab();
    await screen.findByTestId("files-table");
    expect(screen.getByTestId("files-navbar").className).toContain("sticky");
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
    expect(await screen.findByTestId("crumb-0")).toHaveTextContent("etc");
  });

  it("moves up to the parent directory", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : [])
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    await waitFor(() => expect(screen.getByTestId("crumb-0")).toHaveTextContent("etc"));
    await user.click(screen.getByTestId("files-up"));
    await waitFor(() => expect(screen.queryByTestId("crumb-0")).not.toBeInTheDocument());
  });

  it("navigates back and forward through history", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.stat).mockImplementation(() =>
      Promise.resolve({ type: "directory", size: null, modified: null })
    );
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : path === "/etc" ? ["nginx"] : [])
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    await screen.findByTestId("file-row-nginx");
    await user.click(screen.getByTestId("file-row-nginx"));
    await waitFor(() => expect(screen.getByTestId("crumb-1")).toHaveTextContent("nginx"));

    await user.click(screen.getByTestId("files-back"));
    await waitFor(() => expect(screen.queryByTestId("crumb-1")).not.toBeInTheDocument());
    expect(screen.getByTestId("crumb-0")).toHaveTextContent("etc");

    await user.click(screen.getByTestId("files-forward"));
    await waitFor(() => expect(screen.getByTestId("crumb-1")).toHaveTextContent("nginx"));

    // Back is still enabled; forward is disabled at the tip of the history.
    expect(screen.getByTestId("files-back")).toBeEnabled();
    expect(screen.getByTestId("files-forward")).toBeDisabled();
  });

  it("navigates via breadcrumb segments", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.stat).mockImplementation(() =>
      Promise.resolve({ type: "directory", size: null, modified: null })
    );
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : path === "/etc" ? ["nginx"] : [])
    );
    renderTab();
    await user.click(await screen.findByTestId("file-row-etc"));
    await screen.findByTestId("file-row-nginx");
    await user.click(screen.getByTestId("file-row-nginx"));
    await waitFor(() => expect(screen.getByTestId("crumb-1")).toHaveTextContent("nginx"));

    await user.click(screen.getByTestId("crumb-root"));
    await waitFor(() => expect(screen.queryByTestId("crumb-0")).not.toBeInTheDocument());
    expect(await screen.findByTestId("file-row-etc")).toBeInTheDocument();
  });

  it("clicking the address bar switches to a path input", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    expect(input).toHaveValue("/");
    expect(screen.queryByTestId("files-breadcrumbs")).not.toBeInTheDocument();
  });

  it("entering a custom path navigates on Enter", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : ["nginx.conf"])
    );
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/etc{Enter}");
    await waitFor(() => expect(filesApi.read).toHaveBeenCalledWith("web1", "/etc", "default"));
    expect(await screen.findByTestId("crumb-0")).toHaveTextContent("etc");
    expect(screen.queryByTestId("files-path-input")).not.toBeInTheDocument();
  });

  it("normalizes a path typed without a leading slash", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      Promise.resolve(path === "/" ? ["etc"] : ["nginx.conf"])
    );
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "etc/nginx/{Enter}");
    await waitFor(() => expect(filesApi.read).toHaveBeenCalledWith("web1", "/etc/nginx", "default"));
    expect(await screen.findByTestId("crumb-1")).toHaveTextContent("nginx");
  });

  it("escape cancels path editing without navigating", async () => {
    const user = userEvent.setup();
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/etc{Escape}");
    expect(screen.queryByTestId("files-path-input")).not.toBeInTheDocument();
    expect(await screen.findByTestId("files-breadcrumbs")).toBeInTheDocument();
    expect(filesApi.read).not.toHaveBeenCalledWith("web1", "/etc", "default");
  });

  it("shows an error in the field for a nonexistent path", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      path === "/nope"
        ? Promise.reject(new Error("not found"))
        : Promise.resolve(["etc"])
    );
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/nope{Enter}");
    expect(await screen.findByTestId("files-path-error")).toHaveTextContent("Path not found: /nope");
    // The input stays open with an error highlight so the user can correct it.
    expect(screen.getByTestId("files-path-input")).toBeInTheDocument();
    expect(screen.getByTestId("files-path-input").className).toContain("border-danger");
    expect(screen.getByTestId("files-path-input")).toHaveAttribute("aria-invalid", "true");
    // No navigation happened: still at the root.
    expect(screen.queryByTestId("crumb-0")).not.toBeInTheDocument();
  });

  it("clears the path error while typing", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) =>
      path === "/nope"
        ? Promise.reject(new Error("not found"))
        : Promise.resolve(["etc"])
    );
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/nope{Enter}");
    expect(await screen.findByTestId("files-path-error")).toBeInTheDocument();
    await user.type(input, "x");
    expect(screen.queryByTestId("files-path-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("files-path-input").className).not.toContain("border-danger");
  });

  it("entering a file path opens its parent directory and the editor", async () => {
    const user = userEvent.setup();
    vi.mocked(filesApi.read).mockImplementation((_i, path) => {
      if (path === "/") return Promise.resolve(["etc"]);
      if (path === "/etc") return Promise.resolve(["motd"]);
      if (path === "/etc/motd") return Promise.resolve("hello");
      return Promise.resolve([]);
    });
    renderTab();
    await screen.findByTestId("files-table");
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/etc/motd{Enter}");
    await waitFor(() => expect(screen.getByTestId("crumb-0")).toHaveTextContent("etc"));
    expect(await screen.findByTestId("file-content")).toHaveValue("hello");
    expect(screen.queryByTestId("files-path-error")).not.toBeInTheDocument();
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
