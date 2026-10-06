import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupsTab } from "./backups";
import type { BackupsActions } from "./backups";
import { backupsApi } from "../../api";

vi.mock("../../api", () => ({
  backupsApi: {
    list: vi.fn(),
    create: vi.fn().mockResolvedValue({ type: "async", operation: "/1.0/operations/o1" }),
    delete: vi.fn().mockResolvedValue(undefined),
    exportUrl: vi.fn().mockReturnValue("/export"),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ status: "Success" }) },
}));

const backup = (name: string) => ({ name, created_at: "2026-01-01T00:00:00Z", optimized_storage: false, compression: "gzip", instance_only: true, expires_at: "0001-01-01T00:00:00Z" });

describe("BackupsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(backupsApi.list).mockResolvedValue([backup("b1")]);
  });

  it("lists backups with scope and no expiry", async () => {
    render(<BackupsTab instanceName="web1" />);
    expect(await screen.findByText("b1")).toBeInTheDocument();
    expect(screen.getByText("Instance only")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.mocked(backupsApi.list).mockResolvedValue([]);
    render(<BackupsTab instanceName="web1" />);
    expect(await screen.findByText("No backups")).toBeInTheDocument();
  });

  it("creates a backup with options and waits for the operation", async () => {
    const user = userEvent.setup();
    let actions: BackupsActions | null = null;
    render(<BackupsTab instanceName="web1" project="p" registerActions={(a) => { actions = a; }} />);
    await screen.findByText("b1");
    act(() => actions!.create());
    const name = screen.getByTestId("backup-name");
    await user.clear(name);
    await user.type(name, "nightly");
    await user.click(screen.getByText("Instance only (exclude snapshots)"));
    await user.click(screen.getByTestId("backup-create-submit"));
    await waitFor(() =>
      expect(backupsApi.create).toHaveBeenCalledWith("web1", "nightly", { instance_only: true, optimized_storage: false }, "p"),
    );
  });

  it("deletes after confirmation", async () => {
    const user = userEvent.setup();
    render(<BackupsTab instanceName="web1" />);
    await user.click(await screen.findByTestId("backup-delete-b1"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(backupsApi.delete).toHaveBeenCalledWith("web1", "b1", undefined));
  });
});
