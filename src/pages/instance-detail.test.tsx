import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { InstanceDetailPage } from "./instance-detail";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function instance() {
  return {
    name: "web1", status: "Stopped", type: "container", description: "web server",
    created_at: "2026-01-01T00:00:00Z", last_used_at: "2026-01-02T00:00:00Z",
    config: { "limits.memory": "512MiB", "limits.cpu": "2" }, devices: {}, profiles: ["default"],
    project: "default", ephemeral: false,
  };
}

vi.mock("../api", () => ({
  instancesApi: {
    get: vi.fn().mockResolvedValue(instance()),
    state: vi.fn().mockResolvedValue({ status: "Stopped", cpu: { usage: 0 }, memory: { usage: 0 }, network: { eth0: { addresses: [{ family: "inet", address: "192.168.0.6", netmask: "16", scope: "global" }, { family: "inet6", address: "2001:db8::1", netmask: "64", scope: "global" }] } } }),
    setState: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(null),
    rename: vi.fn().mockResolvedValue(null),
    move: vi.fn().mockResolvedValue(null),
  },
  infraApi: { listImages: vi.fn().mockResolvedValue([]), listProfiles: vi.fn().mockResolvedValue([]), listNetworks: vi.fn().mockResolvedValue([]), listPools: vi.fn().mockResolvedValue([{ name: "default", description: "", driver: "dir", status: "", used_by: [] }]), listProjects: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {} }, { name: "prod", description: "", config: {} }]) },
  clusterApi: { listMembers: vi.fn().mockResolvedValue([{ server_name: "incus-1", url: "https://incus-1:8443", database: true, status: "Online", message: "", architecture: "x86_64" }]) },
  backupsApi: {
    create: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "op-export", metadata: null }),
    exportUrl: (i: string, n: string) => `/1.0/instances/${i}/backups/${n}/export?project=default`,
  },
  operationsApi: {
    wait: vi.fn().mockResolvedValue({ id: "op-export", class: "task", description: "Backing up instance", status: "Success", status_code: 200, created_at: "t", updated_at: "t", may_cancel: false }),
  },
  serverApi: { metadata: vi.fn().mockResolvedValue({ configs: [] }) },
  api: { get: vi.fn() },
}));

function renderPage(initialEntry = "/instances/web1") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InstanceDetailPage", () => {
  it("shows instance overview", async () => {
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText("web1")).toBeInTheDocument();
    expect(screen.getByText("web server")).toBeInTheDocument();
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
    expect(screen.getByText("512MiB")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(await screen.findByText("192.168.0.6")).toBeInTheDocument();
    expect(screen.getByText("2001:db8::1")).toBeInTheDocument();
  });

  it("switches tabs", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("vtab-config"));
    expect(screen.getByTestId("config-tab")).toBeInTheDocument();
  });

  it("renders the devices tab", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("vtab-devices"));
    expect(await screen.findByTestId("devices-tab")).toBeInTheDocument();
  });

  it("falls back to Overview for stale console deep links", async () => {
    render(
      <MemoryRouter initialEntries={["/instances/web1/console"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    expect(screen.getByTestId("overview-tab")).toBeInTheDocument();
    expect(screen.getByTestId("vtab-overview")).toHaveAttribute("aria-selected", "true");
  });

  it("starts the instance from the header", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-action-start"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "start"));
  });

  it("renders the action strip", async () => {
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    expect(screen.getByTestId("instance-strip")).toBeInTheDocument();
  });

  it("opens the terminal popup", async () => {
    const user = userEvent.setup();
    const openSpy = vi.fn();
    const restore = () => vi.unstubAllGlobals();
    vi.stubGlobal("open", openSpy);
    render(
      <MemoryRouter initialEntries={["/instances/web1"]}>
        <Routes>
          <Route path="/instances/:name/:tab?" element={<InstanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-terminal"));
    expect(openSpy).toHaveBeenCalledWith("/ui/terminal/web1?project=default", "terminal-web1", "width=1000,height=640");
    restore();
  });

  it("opens the more menu from the header", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    expect(screen.getByTestId("detail-more-menu")).toBeInTheDocument();
  });

  it("validates the rename name and calls rename on submit", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-rename"));
    await user.type(screen.getByTestId("rename-name"), "bad name!");
    expect(screen.getByText("Name must contain only letters, numbers, and hyphens")).toBeInTheDocument();
    await user.clear(screen.getByTestId("rename-name"));
    await user.type(screen.getByTestId("rename-name"), "web2");
    await user.click(screen.getByTestId("rename-confirm"));
    await waitFor(() => expect(instancesApi.rename).toHaveBeenCalledWith("web1", "web2"));
  });

  it("navigates to the new name after rename", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-rename"));
    await user.type(screen.getByTestId("rename-name"), "web2");
    await user.click(screen.getByTestId("rename-confirm"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/instances/web2"));
  });

  it("copies the instance with live and pool options", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-copy"));
    await user.type(screen.getByTestId("copy-name"), "web2");
    await user.click(screen.getByTestId("copy-live"));
    await user.selectOptions(screen.getByTestId("copy-pool"), "default");
    await user.click(screen.getByTestId("copy-confirm"));
    await waitFor(() => expect(instancesApi.copy).toHaveBeenCalledWith("web1", "web2", { live: true, pool: "default" }));
  });

  it("moves the instance with project, member, and live options", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-move"));
    await user.selectOptions(screen.getByTestId("move-project"), "prod");
    await user.selectOptions(screen.getByTestId("move-member"), "incus-1");
    await user.click(screen.getByTestId("move-live"));
    await user.click(screen.getByTestId("move-confirm"));
    await waitFor(() => expect(instancesApi.move).toHaveBeenCalledWith("web1", { project: "prod", target: "incus-1", live: true }));
  });

  it("navigates to the instances list when moved to another project", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-move"));
    await user.selectOptions(screen.getByTestId("move-project"), "prod");
    await user.click(screen.getByTestId("move-confirm"));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/instances"));
  });

  it("exports a backup via blob download through the authenticated client", async () => {
    const user = userEvent.setup();
    const { backupsApi, operationsApi } = await import("../api");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: vi.fn().mockResolvedValue(new Blob(["tar"])) });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectUrl = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const restore = () => vi.unstubAllGlobals();
    renderPage();
    await screen.findByText("web1");
    await user.click(screen.getByTestId("detail-more"));
    await user.click(screen.getByTestId("detail-more-export"));
    await waitFor(() => expect(backupsApi.create).toHaveBeenCalledWith("web1", expect.stringMatching(/^export-\d+$/)));
    await waitFor(() => expect(operationsApi.wait).toHaveBeenCalledWith("op-export"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/1\.0\/instances\/web1\/backups\/export-\d+\/export\?project=default$/),
        { credentials: "include" }
      )
    );
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:mock");
    restore();
  });
});
