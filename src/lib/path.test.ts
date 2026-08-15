import { basenameOf, joinPath, normalizeTypedPath, parentOf, resolveLinkTarget } from "./path";

describe("path helpers", () => {
  it("joins paths", () => {
    expect(joinPath("/", "etc")).toBe("/etc");
    expect(joinPath("/etc", "nginx")).toBe("/etc/nginx");
  });

  it("computes parents", () => {
    expect(parentOf("/etc/nginx/nginx.conf")).toBe("/etc/nginx");
    expect(parentOf("/etc")).toBe("/");
    expect(parentOf("/")).toBe("/");
  });

  it("computes basenames", () => {
    expect(basenameOf("/etc/nginx/nginx.conf")).toBe("nginx.conf");
    expect(basenameOf("/")).toBe("");
  });

  it("normalizes typed paths", () => {
    expect(normalizeTypedPath("/etc")).toBe("/etc");
    expect(normalizeTypedPath("etc/nginx")).toBe("/etc/nginx");
    expect(normalizeTypedPath("/etc/")).toBe("/etc");
    expect(normalizeTypedPath("\\etc\\nginx")).toBe("/etc/nginx");
    expect(normalizeTypedPath("//etc///nginx/")).toBe("/etc/nginx");
    expect(normalizeTypedPath("")).toBe("/");
    expect(normalizeTypedPath("/")).toBe("/");
  });

  it("resolves symlink targets", () => {
    // Absolute targets pass through (trailing slashes trimmed).
    expect(resolveLinkTarget("/var/run", "/run")).toBe("/run");
    expect(resolveLinkTarget("/var/run", "/run/")).toBe("/run");
    // Relative targets resolve against the link's own directory.
    expect(resolveLinkTarget("/etc/init.d/rc", "rc.d/../rc")).toBe("/etc/init.d/rc");
    expect(resolveLinkTarget("/etc/foo", "bar/")).toBe("/etc/bar");
    expect(resolveLinkTarget("/etc/foo", "../lib/foo")).toBe("/lib/foo");
    // Walking past the root clamps to the root.
    expect(resolveLinkTarget("/a/b", "../../x")).toBe("/x");
    expect(resolveLinkTarget("/a", "../../../../x")).toBe("/x");
    // Empty target falls back to the link path.
    expect(resolveLinkTarget("/etc/foo", "")).toBe("/etc/foo");
  });
});
