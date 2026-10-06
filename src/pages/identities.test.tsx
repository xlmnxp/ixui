import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentitiesPage } from "./identities";
import { authApi } from "../api";
import { ApiError } from "../api/client";

vi.mock("../api", () => ({
  authApi: {
    listIdentities: vi.fn(),
    listGroups: vi.fn(),
    updateIdentityGroups: vi.fn().mockResolvedValue(null),
    deleteIdentity: vi.fn().mockResolvedValue(undefined),
    createGroup: vi.fn().mockResolvedValue(null),
    updateGroup: vi.fn().mockResolvedValue(null),
    deleteGroup: vi.fn().mockResolvedValue(undefined),
  },
}));

const alice = { authentication_method: "oidc", type: "OIDC client", identifier: "alice@example.org", name: "Alice", groups: ["admins"] };
const admins = { name: "admins", description: "all powerful", permissions: [{ entity_type: "server", url: "/1.0", entitlement: "admin" }], identities: { oidc: ["alice@example.org"] } };

describe("IdentitiesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.listIdentities).mockResolvedValue([alice]);
    vi.mocked(authApi.listGroups).mockResolvedValue([admins, { name: "viewers", description: "", permissions: null, identities: null }]);
  });

  it("lists identities with their groups", async () => {
    render(<IdentitiesPage />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("admins")).toBeInTheDocument();
  });

  it("uses vertical side tabs for identities and groups", async () => {
    const user = userEvent.setup();
    render(<IdentitiesPage />);
    await screen.findByText("Alice");
    expect(screen.getByTestId("vertical-tabs")).toBeInTheDocument();
    expect(screen.queryByTestId("authgroup-create-open")).toBeNull();
    await user.click(screen.getByTestId("vtab-groups"));
    expect(screen.getByTestId("authgroups-table")).toBeInTheDocument();
    expect(screen.getByTestId("authgroup-create-open")).toBeInTheDocument();
  });

  it("assigns groups to an identity", async () => {
    const user = userEvent.setup();
    render(<IdentitiesPage />);
    await user.click(await screen.findByTestId("identity-edit-alice@example.org"));
    await user.click(screen.getByTestId("identity-group-viewers"));
    await user.click(screen.getByTestId("identity-save"));
    await waitFor(() => expect(authApi.updateIdentityGroups).toHaveBeenCalledWith(alice, ["admins", "viewers"]));
  });

  it("creates a group with a permission", async () => {
    const user = userEvent.setup();
    render(<IdentitiesPage />);
    await screen.findByText("Alice");
    await user.click(screen.getByTestId("vtab-groups"));
    await user.click(screen.getByTestId("authgroup-create-open"));
    await user.type(screen.getByTestId("authgroup-name"), "ops");
    await user.click(screen.getByTestId("perm-add"));
    await user.type(screen.getByTestId("perm-type-0"), "project");
    await user.type(screen.getByTestId("perm-entitlement-0"), "operator");
    await user.type(screen.getByTestId("perm-url-0"), "/1.0/projects/default");
    await user.click(screen.getByTestId("authgroup-save"));
    await waitFor(() => expect(authApi.createGroup).toHaveBeenCalledWith("ops", ""));
    expect(authApi.updateGroup).toHaveBeenCalledWith("ops", { description: "", permissions: [{ entity_type: "project", url: "/1.0/projects/default", entitlement: "operator" }] });
  });

  it("edits an existing group keeping its permissions", async () => {
    const user = userEvent.setup();
    render(<IdentitiesPage />);
    await screen.findByText("Alice");
    await user.click(screen.getByTestId("vtab-groups"));
    await user.click(screen.getByTestId("authgroup-edit-admins"));
    const desc = screen.getByTestId("authgroup-desc");
    await user.clear(desc);
    await user.type(desc, "root");
    await user.click(screen.getByTestId("authgroup-save"));
    await waitFor(() => expect(authApi.updateGroup).toHaveBeenCalledWith("admins", { description: "root", permissions: admins.permissions }));
  });

  it("deletes an identity after confirmation", async () => {
    const user = userEvent.setup();
    render(<IdentitiesPage />);
    await user.click(await screen.findByTestId("identity-delete-alice@example.org"));
    const dialogs = screen.getAllByTestId("dialog");
    await user.click(within(dialogs.at(-1)!).getByTestId("confirm-confirm"));
    await waitFor(() => expect(authApi.deleteIdentity).toHaveBeenCalledWith(alice));
  });

  it("explains when fine-grained auth is unavailable", async () => {
    vi.mocked(authApi.listIdentities).mockRejectedValue(new ApiError(404, undefined, "not found"));
    render(<IdentitiesPage />);
    expect(await screen.findByTestId("permission-denied")).toBeInTheDocument();
  });
});
