import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AclsPage } from "./acls";
import type { Acl } from "../api/network-extras";

function acl(name: string, extra: Partial<Acl> = {}): Acl {
  return { name, description: "", ingress: [], egress: [], used_by: [], ...extra };
}

vi.mock("../api", () => ({
  networkExtrasApi: {
    listAcls: vi.fn().mockResolvedValue([
      acl("web", {
        description: "web rules",
        ingress: [{ action: "allow", state: "enabled", protocol: "tcp", source: "10.0.0.0/24" }],
        egress: [{ action: "allow", state: "enabled", protocol: "tcp", destination: "0.0.0.0/0" }],
        used_by: ["nic1"],
      }),
      acl("db"),
    ]),
    createAcl: vi.fn().mockResolvedValue(null),
    deleteAcl: vi.fn().mockResolvedValue(undefined),
    updateAcl: vi.fn().mockResolvedValue(null),
  },
}));

describe("AclsPage", () => {
  it("lists ACLs with rule counts and used_by", async () => {
    render(<AclsPage />);
    expect(await screen.findByText("web")).toBeInTheDocument();
    expect(screen.getByText("db")).toBeInTheDocument();
    expect(screen.getByText("web rules")).toBeInTheDocument();
    expect(screen.getByText("nic1")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });

  it("creates an ACL", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<AclsPage />);
    await screen.findByText("web");
    await user.click(screen.getByTestId("acl-create-open"));
    await user.type(screen.getByTestId("acl-name"), "web2");
    await user.type(screen.getByTestId("acl-desc"), "second web");
    await user.click(screen.getByTestId("acl-create-submit"));
    await waitFor(() =>
      expect(networkExtrasApi.createAcl).toHaveBeenCalledWith({ name: "web2", description: "second web" })
    );
  });

  it("deletes with confirmation", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<AclsPage />);
    await screen.findByText("web");
    await user.click(screen.getByTestId("acl-delete-db"));
    await user.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => expect(networkExtrasApi.deleteAcl).toHaveBeenCalledWith("db"));
  });

  it("adds an ingress rule and saves the ACL", async () => {
    const user = userEvent.setup();
    const { networkExtrasApi } = await import("../api");
    render(<AclsPage />);
    await screen.findByText("web");
    await user.click(screen.getByTestId("acl-rules-web"));
    await screen.findByTestId("acl-ingress-rule-0");
    await user.click(screen.getByTestId("acl-add-ingress"));
    await user.type(screen.getByTestId("rule-protocol"), "tcp");
    await user.type(screen.getByTestId("rule-source"), "10.0.1.0/24");
    await user.type(screen.getByTestId("rule-destination-port"), "443");
    await user.click(screen.getByTestId("rule-add-submit"));
    await screen.findByTestId("acl-ingress-rule-1");
    await user.click(screen.getByTestId("acl-rules-save"));
    await waitFor(() =>
      expect(networkExtrasApi.updateAcl).toHaveBeenCalledWith(
        "web",
        expect.objectContaining({
          ingress: expect.arrayContaining([
            expect.objectContaining({ protocol: "tcp", source: "10.0.1.0/24", destination_port: "443" }),
          ]),
        })
      )
    );
  });
});
