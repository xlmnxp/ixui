import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverviewTab } from "./instance-overview";
import type { Instance } from "../api/types";

const instance = (type: Instance["type"]): Instance => ({
  name: "web1",
  status: "Running",
  type,
  description: "",
  created_at: "t",
  last_used_at: "t",
  config: {},
  devices: {},
  profiles: ["default"],
  project: "default",
  ephemeral: false,
});

vi.mock("../api", () => ({
  instancesApi: {
    state: vi.fn().mockResolvedValue(null),
    screenshotUrl: (name: string, project?: string) =>
      `/1.0/instances/${name}/console${project ? `?project=${project}&` : "?"}type=vga`,
  },
}));

describe("OverviewTab console preview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(new Blob(["png-bytes"], { type: "image/png" }), { status: 200 })
    ));
    vi.stubGlobal("open", vi.fn());
    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the console preview for VMs", async () => {
    render(<OverviewTab instance={instance("virtual-machine")} />);
    expect(await screen.findByTestId("screenshot-image")).toHaveAttribute("src", "blob:mock");
    expect(screen.getByText("Console preview")).toBeInTheDocument();
    expect(screen.getByTestId("screenshot-refresh")).toBeInTheDocument();
    expect(screen.getByText("Click to open console")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/1.0/instances/web1/console?project=default&type=vga",
      { credentials: "include" }
    );
  });

  it("refreshes the screenshot with a cache-busting query", async () => {
    const user = userEvent.setup();
    render(<OverviewTab instance={instance("virtual-machine")} />);
    await screen.findByTestId("screenshot-image");
    await user.click(screen.getByTestId("screenshot-refresh"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const url = vi.mocked(fetch).mock.calls[1]![0] as string;
    expect(url).toContain("type=vga&_=");
  });

  it("opens the terminal popup when the screenshot is clicked", async () => {
    const user = userEvent.setup();
    render(<OverviewTab instance={instance("virtual-machine")} />);
    await screen.findByTestId("screenshot-image");
    await user.click(screen.getByTestId("screenshot-open-console"));
    expect(window.open).toHaveBeenCalledWith(
      "/ui/terminal/web1?project=default",
      "terminal-web1",
      "width=1000,height=640"
    );
  });

  it("shows an error message when the screenshot fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("nope", { status: 500 })
    );
    render(<OverviewTab instance={instance("virtual-machine")} />);
    expect(await screen.findByTestId("screenshot-error")).toBeInTheDocument();
  });

  it("hides the console preview for containers", async () => {
    render(<OverviewTab instance={instance("container")} />);
    await waitFor(() => expect(screen.getByTestId("overview-tab")).toBeInTheDocument());
    expect(screen.queryByTestId("console-preview")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
