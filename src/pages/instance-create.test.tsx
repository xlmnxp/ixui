import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { InstanceCreatePage } from "./instance-create";

vi.mock("../api", () => ({
  infraApi: {
    listImages: vi.fn().mockResolvedValue([
      { fingerprint: "f1", filename: "f1.img", description: "Ubuntu 24.04", public: true, created_at: "t", size: 100, type: "container", properties: {} },
      { fingerprint: "f2", filename: "f2.img", description: "Debian 12", public: true, created_at: "t", size: 200, type: "virtual-machine", properties: {} },
    ]),
    listProfiles: vi.fn().mockResolvedValue([{ name: "default", description: "", config: {}, devices: {} }]),
    listNetworks: vi.fn().mockResolvedValue([]),
    listPools: vi.fn().mockResolvedValue([]),
  },
  instancesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ type: "async", status: "Running", status_code: 100, operation: "op1", metadata: null }),
  },
  operationsApi: { wait: vi.fn().mockResolvedValue({ status: "Success" }) },
  api: { get: vi.fn() },
}));

describe("InstanceCreatePage", () => {
  it("validates the name", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/instances/new"]}>
        <Routes>
          <Route path="/instances/new" element={<InstanceCreatePage />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    );
    const name = screen.getByTestId("create-name");
    await user.type(name, "bad name!");
    await user.click(screen.getByTestId("create-submit"));
    expect(screen.getByText(/must contain only/)).toBeInTheDocument();
  });

  it("creates a container with the chosen image", async () => {
    const user = userEvent.setup();
    const { instancesApi } = await import("../api");
    render(
      <MemoryRouter initialEntries={["/instances/new"]}>
        <Routes>
          <Route path="/instances/new" element={<InstanceCreatePage />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Ubuntu 24.04");
    await user.type(screen.getByTestId("create-name"), "web1");
    await user.click(screen.getByTestId("create-submit"));
    await waitFor(() =>
      expect(instancesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "web1", type: "container", source: expect.objectContaining({ fingerprint: "f1" }) })
      )
    );
  });
});
