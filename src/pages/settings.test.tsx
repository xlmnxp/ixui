import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./settings";
import { ApiError } from "../api/client";

vi.mock("../api", () => ({
  serverApi: {
    info: vi.fn().mockResolvedValue({
      api_extensions: [],
      api_status: "Stable",
      auth: "trusted",
      environment: { server: "incus-1", server_version: "6.8", project: "default" },
      config: {
        "core.https_address": "10.0.0.1:8443",
        "core.trust_token": "super-secret-token",
        "server.name": "ix",
      },
    }),
    updateConfig: vi.fn().mockResolvedValue(null),
  },
}));

describe("SettingsPage", () => {
  it("loads the config and masks sensitive values", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("10.0.0.1:8443")).toBeInTheDocument();
    expect(screen.queryByText("super-secret-token")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••")).toHaveLength(1);
  });

  it("saves the config with sensitive originals restored", async () => {
    const user = userEvent.setup();
    const { serverApi } = await import("../api");
    render(<SettingsPage />);
    await screen.findByText("10.0.0.1:8443");
    await user.click(screen.getByTestId("settings-save"));
    await waitFor(() =>
      expect(serverApi.updateConfig).toHaveBeenCalledWith({
        "core.https_address": "10.0.0.1:8443",
        "core.trust_token": "super-secret-token",
        "server.name": "ix",
      })
    );
  });

  it("saves edited values and resets the display", async () => {
    const user = userEvent.setup();
    const { serverApi } = await import("../api");
    render(<SettingsPage />);
    await screen.findByText("10.0.0.1:8443");
    await user.dblClick(screen.getByTestId("kv-value-core.https_address"));
    const input = screen.getByTestId("kv-value-edit-core.https_address");
    await user.clear(input);
    await user.type(input, "10.0.0.2:8443");
    await user.keyboard("{Enter}");
    await user.click(screen.getByTestId("settings-save"));
    await waitFor(() =>
      expect(serverApi.updateConfig).toHaveBeenCalledWith({
        "core.https_address": "10.0.0.2:8443",
        "core.trust_token": "super-secret-token",
        "server.name": "ix",
      })
    );
    await user.click(screen.getByTestId("settings-reset"));
    expect(screen.getByText("10.0.0.1:8443")).toBeInTheDocument();
  });

  it("shows editor actions in the page bar and removes a selected row", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await screen.findByText("10.0.0.1:8443");
    expect(screen.getByTestId("settings-remove")).toBeInTheDocument();
    expect(screen.getByTestId("settings-remove")).toBeDisabled();
    expect(screen.queryByTestId("kv-add")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("kv-check-core.https_address"));
    expect(screen.getByTestId("settings-remove")).toBeEnabled();
    await user.click(screen.getByTestId("settings-remove"));
    expect(screen.queryByText("10.0.0.1:8443")).not.toBeInTheDocument();
  });

  it("shows permission denied instead of crashing on 403", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockRejectedValueOnce(new ApiError(403, 403, "denied"));
    render(<SettingsPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
  });
});
