import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstanceContextMenu } from "./instance-context-menu";
import type { ClusterMember, Instance } from "../api/types";

vi.mock("../api", () => ({
  instancesApi: {
    setState: vi.fn().mockResolvedValue(null),
    move: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
  },
  infraApi: {},
  clusterApi: {},
  operationsApi: { wait: vi.fn() },
}));

const instance = (over: Partial<Instance> = {}): Instance =>
  ({ name: "web1", project: "default", status: "Running", type: "container", location: "incus-1", ...over }) as Instance;

const member = (name: string): ClusterMember =>
  ({ server_name: name, url: "", database: true, status: "Online", message: "", architecture: "x86_64" }) as ClusterMember;

describe("InstanceContextMenu", () => {
  it("disables start while running and stop/restart while stopped", () => {
    const { rerender } = render(
      <InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={() => {}} />
    );
    expect(screen.getByTestId("ctx-start")).toBeDisabled();
    expect(screen.getByTestId("ctx-stop")).toBeEnabled();
    expect(screen.getByTestId("ctx-restart")).toBeEnabled();
    rerender(
      <InstanceContextMenu instance={instance({ status: "Stopped" })} x={10} y={10} members={[]} onClose={() => {}} />
    );
    expect(screen.getByTestId("ctx-start")).toBeEnabled();
    expect(screen.getByTestId("ctx-stop")).toBeDisabled();
    expect(screen.getByTestId("ctx-restart")).toBeDisabled();
  });

  it("requests a stop and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi } = await import("../api");
    render(<InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={onClose} />);
    await user.click(screen.getByTestId("ctx-stop"));
    await waitFor(() => expect(instancesApi.setState).toHaveBeenCalledWith("web1", "stop", false, "default"));
    expect(onClose).toHaveBeenCalled();
  });

  it("opens a terminal window", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={onClose} />);
    await user.click(screen.getByTestId("ctx-terminal"));
    expect(open).toHaveBeenCalledWith("/ui/terminal/web1?project=default", "terminal-web1", "width=1000,height=640");
    expect(onClose).toHaveBeenCalled();
    open.mockRestore();
  });

  it("disables move-to-node without other members and lists them otherwise", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    const { rerender } = render(
      <InstanceContextMenu instance={instance()} x={10} y={10} members={[member("incus-1")]} onClose={() => {}} />
    );
    expect(screen.getByTestId("ctx-move")).toBeDisabled();
    rerender(
      <InstanceContextMenu instance={instance()} x={10} y={10} members={[member("incus-1"), member("incus-2")]} onClose={() => {}} />
    );
    expect(screen.getByTestId("ctx-move")).toBeEnabled();
    await user.click(screen.getByTestId("ctx-move-incus-2"));
    await waitFor(() => expect(instancesApi.move).toHaveBeenCalledWith("web1", { target: "incus-2" }, "default"));
  });

  it("renames through the rename dialog", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(<InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={() => {}} />);
    await user.click(screen.getByTestId("ctx-rename"));
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("rename-name")).toHaveValue("web1");
    await user.clear(screen.getByTestId("rename-name"));
    await user.type(screen.getByTestId("rename-name"), "web2");
    await user.click(screen.getByTestId("rename-confirm"));
    await waitFor(() => expect(instancesApi.rename).toHaveBeenCalledWith("web1", "web2", "default"));
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { instancesApi } = await import("../api");
    render(<InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={onClose} />);
    await user.click(screen.getByTestId("ctx-delete"));
    expect(screen.queryByTestId("context-menu")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(instancesApi.delete).toHaveBeenCalledWith("web1", "default"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InstanceContextMenu instance={instance()} x={10} y={10} members={[]} onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
