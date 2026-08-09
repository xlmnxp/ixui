import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogsTab } from "./logs";

vi.mock("../../api", () => ({
  instancesApi: {
    listLogs: vi.fn().mockResolvedValue(["console.log", "config.json"]),
    readLog: vi.fn().mockResolvedValue("line1\nline2"),
  },
}));

describe("LogsTab", () => {
  it("lists files and shows content", async () => {
    render(<LogsTab instanceName="web1" />);
    expect(await screen.findByText("console.log")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("log-content")).toHaveTextContent("line1"));
  });

  it("switches files", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../../api");
    render(<LogsTab instanceName="web1" />);
    await screen.findByText("config.json");
    await user.click(screen.getByTestId("log-file-config.json"));
    expect(instancesApi.readLog).toHaveBeenCalledWith("web1", "config.json");
  });
});
