import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilesPage } from "./profiles";

function profile(name: string) {
  return { name, description: `desc ${name}`, config: { "limits.cpu": "2" }, devices: {} };
}

vi.mock("../api", () => ({
  infraApi: {
    listProfiles: vi.fn().mockResolvedValue([profile("default"), profile("web")]),
    getProfile: vi.fn().mockResolvedValue(profile("default")),
    createProfile: vi.fn().mockResolvedValue(null),
    updateProfile: vi.fn().mockResolvedValue(null),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
  },
  serverApi: {
    metadata: vi.fn().mockResolvedValue({ configs: {} }),
  },
}));

describe("ProfilesPage", () => {
  it("lists profiles", async () => {
    render(<ProfilesPage />);
    expect(await screen.findByText("default")).toBeInTheDocument();
    expect(screen.getByText("desc default")).toBeInTheDocument();
  });

  it("creates a profile", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProfilesPage />);
    await screen.findByText("default");
    await user.click(screen.getByTestId("profile-create-open"));
    await user.type(screen.getByTestId("profile-name"), "web");
    await user.click(screen.getByTestId("profile-create-submit"));
    await waitFor(() => expect(infraApi.createProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "web" })));
  });

  it("edits config", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProfilesPage />);
    await screen.findByText("default");
    await user.click(screen.getByTestId("profile-edit-default"));
    expect(await screen.findByTestId("kv-key-limits.cpu")).toHaveTextContent("limits.cpu");
    await user.click(screen.getByTestId("profile-save"));
    await waitFor(() => expect(infraApi.updateProfile).toHaveBeenCalledWith("default", expect.objectContaining({ config: { "limits.cpu": "2" } })));
  });

  it("bulk deletes selected profiles", async () => {
    const user = userEvent.setup();
    const { infraApi } = await import("../api");
    render(<ProfilesPage />);
    await screen.findByText("default");
    const checkboxes = screen.getAllByTestId("row-select");
    await user.click(checkboxes[0]!);
    await user.click(checkboxes[1]!);
    await user.click(screen.getByTestId("action-delete"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(infraApi.deleteProfile).toHaveBeenCalledWith("default"));
    await waitFor(() => expect(infraApi.deleteProfile).toHaveBeenCalledWith("web"));
  });
});
