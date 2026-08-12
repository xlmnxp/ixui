import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { authStore } from "../auth/status";
import { AuthPage } from "./auth";

vi.mock("../api", () => ({
  authApi: {
    listIdentities: vi.fn().mockResolvedValue([
      { type: "certificate", id: "fpr-1234", name: "alice", groups: ["admins"], access_entitlements: [] },
      { type: "oidc", id: "user@example.com", name: "bob", groups: [], access_entitlements: [] },
    ]),
    listGroups: vi.fn().mockResolvedValue([
      { name: "admins", description: "Admins", permissions: ["server_edit"] },
      { name: "ops", description: "Operators", permissions: ["instance_create"] },
    ]),
    listPermissions: vi.fn().mockResolvedValue([
      { entitlement: "server_edit", description: "Edit server config" },
      { entitlement: "instance_create", description: "Create instances" },
    ]),
    createGroup: vi.fn().mockResolvedValue(null),
    updateGroup: vi.fn().mockResolvedValue(null),
    updateIdentity: vi.fn().mockResolvedValue(null),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderAuth(initialEntry = "/") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<AuthPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AuthPage", () => {
  beforeEach(() => authStore.setState("authenticated"));
  afterEach(() => authStore.setState("unknown"));

  it("renders the identities table", async () => {
    renderAuth("/?tab=identities");
    expect(await screen.findByText("fpr-1234")).toBeInTheDocument();
    expect(screen.getByText("certificate")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("admins")).toBeInTheDocument();
  });

  it("creates a group with permissions", async () => {
    const user = userEvent.setup();
    const { authApi } = await import("../api");
    renderAuth("/?tab=groups");
    await user.click(await screen.findByTestId("group-create-open"));
    await user.type(screen.getByTestId("group-name"), "ops");
    await user.type(screen.getByTestId("group-description"), "Operators");
    await user.click(screen.getByRole("checkbox", { name: "instance_create" }));
    await user.click(screen.getByTestId("group-create-submit"));
    await waitFor(() =>
      expect(authApi.createGroup).toHaveBeenCalledWith({
        name: "ops",
        description: "Operators",
        permissions: ["instance_create"],
      })
    );
  });

  it("updates identity group membership", async () => {
    const user = userEvent.setup();
    const { authApi } = await import("../api");
    renderAuth("/?tab=identities");
    await user.click(await screen.findByTestId("identity-edit-fpr-1234"));
    await user.click(screen.getByRole("checkbox", { name: "ops" }));
    await user.click(screen.getByTestId("identity-save"));
    await waitFor(() =>
      expect(authApi.updateIdentity).toHaveBeenCalledWith("certificate", "fpr-1234", {
        groups: ["admins", "ops"],
      })
    );
  });

  it("signs out via the oidc logout redirect", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { assign },
      writable: true,
    });
    renderAuth("/");
    await user.click(await screen.findByTestId("auth-logout"));
    expect(assign).toHaveBeenCalledWith("/oidc/logout");
  });
});
