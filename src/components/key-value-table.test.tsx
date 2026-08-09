import { render, screen } from "@testing-library/react";
import { KeyValueTable } from "./key-value-table";

describe("KeyValueTable", () => {
  it("renders rows with header and inert checkboxes", () => {
    render(<KeyValueTable rows={[{ key: "Status", value: "Running" }, { key: "Type", value: "Container" }]} />);
    expect(screen.getByTestId("kv-table")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getAllByTestId("inert-checkbox")).toHaveLength(2);
  });

  it("supports a custom testid", () => {
    render(<KeyValueTable rows={[{ key: "a", value: "b" }]} dataTestId="server-table" />);
    expect(screen.getByTestId("server-table")).toBeInTheDocument();
  });

  it("shows the empty message with no rows", () => {
    render(<KeyValueTable rows={[]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });
});
