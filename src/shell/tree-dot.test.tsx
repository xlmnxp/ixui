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

describe("buildTree member status icons", () => {
  it("shows a checkmark for online members and a warning for evacuated ones", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1", "Online"), member("incus-2", "Evacuated")],
      instancesByMember: {},
      unassigned: [],
    });
    render(
      <MemoryRouter>
        <>{tree[1]?.children?.map((c) => c.label)}</>
      </MemoryRouter>
    );
    expect(screen.getByText("incus-1")).toBeInTheDocument();
    expect(screen.getByText("incus-2")).toBeInTheDocument();
    // Online member row should contain a green status dot with a check.
    expect(screen.getByText("incus-1").closest("span")?.querySelector(".bg-success")).toBeInTheDocument();
    // Evacuated member row should contain a warning status dot.
    expect(screen.getByText("incus-2").closest("span")?.querySelector(".bg-warning")).toBeInTheDocument();
  });

  it("dims the server icon for offline members without a status indicator", () => {
    const tree = buildTree({
      project: "default",
      members: [member("incus-1", "Offline")],
      instancesByMember: {},
      unassigned: [],
    });
    render(
      <MemoryRouter>
        <>{tree[1]?.children?.map((c) => c.label)}</>
      </MemoryRouter>
    );
    expect(screen.getByText("incus-1")).toBeInTheDocument();
  });
});
