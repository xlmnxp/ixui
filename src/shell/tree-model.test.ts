import type { Instance } from "../api/types";
import { buildTree } from "./tree-model";

const member = (name: string) => ({ server_name: name, url: "", database: true, status: "Online", message: "", architecture: "x86_64" });
const instance = (name: string, location?: string): Instance => ({
  name, status: "Running", type: "container", description: "", created_at: "t", last_used_at: "t",
  config: {}, devices: {}, profiles: [], project: "default", ephemeral: false, location,
});

describe("buildTree", () => {
  it("adds hover create actions to project and member nodes", () => {
    const onCreate = vi.fn();
    const tree = buildTree({ project: "default", members: [member("incus-1")], instancesByMember: { "incus-1": [] }, unassigned: [], onCreate });
    const projectNode = tree[1]!;
    expect(projectNode.action).toBeDefined();
    const memberNode = projectNode.children![0]!;
    expect(memberNode.action).toBeDefined();
    expect(projectNode.id).toBe("project-default");
    expect(memberNode.id).toBe("member-incus-1");
  });

  it("nests instances under their member", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-2"), member("incus-1")],
      instancesByMember: { "incus-1": [instance("web1", "incus-1")], "incus-2": [] },
      unassigned: [],
    });
    expect(tree[1]?.id).toBe("project-default");
    const memberChildren = tree[1]?.children ?? [];
    expect(memberChildren.map((m) => m.id)).toEqual(["member-incus-1", "member-incus-2"]);
    expect(memberChildren[0]?.children?.map((i) => i.id)).toEqual(["instance-web1"]);
  });

  it("sorts instances alphabetically", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1")],
      instancesByMember: { "incus-1": [instance("z1", "incus-1"), instance("a1", "incus-1")] },
      unassigned: [],
    });
    const children = tree[1]?.children?.[0]?.children ?? [];
    expect(children.map((i) => i.id)).toEqual(["instance-a1", "instance-z1"]);
  });

  it("adds an unassigned bucket", () => {
    const tree = buildTree({ project: "default", members: [member("incus-1")], instancesByMember: {}, unassigned: [instance("drift")] });
    expect(tree[1]?.children?.some((m) => m.id === "unassigned")).toBe(true);
  });

  it("lists instances directly under the project when there are no members", () => {
    const tree = buildTree({ project: "default", members: [], instancesByMember: {}, unassigned: [instance("z1"), instance("a1")] });
    expect(tree[1]?.children?.map((n) => n.id)).toEqual(["instance-a1", "instance-z1"]);
  });
});
