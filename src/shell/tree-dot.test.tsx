import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildTree } from "./tree-model";
import type { ClusterMember } from "../api/types";

const member = (server_name: string, status: string): ClusterMember => ({
  server_name,
  url: "",
  database: true,
  status,
  message: "",
  architecture: "x86_64",
});

describe("buildTree dot tones", () => {
  it("shows a success dot for online members and a warning dot for evacuated ones", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1", "Online"), member("incus-2", "Evacuated")],
      groups: [{ name: "default", byMember: {}, unassigned: [] }],
    });
    render(
      <MemoryRouter>
        <>{tree[1]?.children?.map((c) => c.label)}</>
      </MemoryRouter>
    );
    expect(screen.getByTestId("member-dot-incus-1")).toHaveClass("bg-success");
    expect(screen.getByTestId("member-dot-incus-2")).toHaveClass("bg-warning");
  });

  it("shows a tertiary dot for offline members", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1", "Offline")],
      groups: [{ name: "default", byMember: {}, unassigned: [] }],
    });
    render(
      <MemoryRouter>
        <>{tree[1]?.children?.map((c) => c.label)}</>
      </MemoryRouter>
    );
    expect(screen.getByTestId("member-dot-incus-1")).toHaveClass("bg-text-tertiary");
  });
});
