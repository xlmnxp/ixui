import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportBackupDialog } from "./import-backup-dialog";
import { instancesApi } from "../api";

vi.mock("../api", () => ({
  infraApi: { listPools: vi.fn().mockResolvedValue([{ name: "fast" }]) },
  instancesApi: {
    importBackup: vi.fn().mockResolvedValue({ type: "async", operation: "/1.0/operations/o1" }),
    list: vi.fn().mockResolvedValue([]),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ status: "Success" }) },
}));

describe("ImportBackupDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disables import until a file is chosen", () => {
    render(<ImportBackupDialog open onClose={() => {}} />);
    expect(screen.getByTestId("import-submit")).toBeDisabled();
  });

  it("uploads the archive with name and pool, then closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportBackupDialog open onClose={onClose} />);
    const file = new File(["x"], "web1.tar.gz", { type: "application/gzip" });
    await user.upload(screen.getByTestId("import-file"), file);
    await user.type(screen.getByTestId("import-name"), "web2");
    await screen.findByRole("option", { name: "fast" });
    await user.selectOptions(screen.getByTestId("import-pool"), "fast");
    await user.click(screen.getByTestId("import-submit"));
    await waitFor(() => expect(instancesApi.importBackup).toHaveBeenCalled());
    const [sent, opts] = vi.mocked(instancesApi.importBackup).mock.calls[0]!;
    expect(sent).toBe(file);
    expect(opts).toEqual({ name: "web2", pool: "fast" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the failure when the import operation fails", async () => {
    const user = userEvent.setup();
    const { operationsApi } = await import("../api");
    vi.mocked(operationsApi.wait).mockResolvedValueOnce({ status: "Failure", err: "bad archive" } as never);
    render(<ImportBackupDialog open onClose={() => {}} />);
    await user.upload(screen.getByTestId("import-file"), new File(["x"], "b.tar.gz"));
    await user.click(screen.getByTestId("import-submit"));
    expect(await screen.findByTestId("import-error")).toHaveTextContent("bad archive");
  });
});
