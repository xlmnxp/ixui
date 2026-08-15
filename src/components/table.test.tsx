import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table } from "./table";
import type { Column } from "./table";

interface Row {
  name: string;
  status: string;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", sortValue: (r) => r.name, render: (r) => r.name },
  { key: "status", header: "Status", render: (r) => r.status },
];

const rows: Row[] = [
  { name: "web1", status: "Started" },
  { name: "db1", status: "Stopped" },
];

describe("Table", () => {
  it("renders rows", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    expect(screen.getByText("web1")).toBeInTheDocument();
    expect(screen.getByText("db1")).toBeInTheDocument();
  });

  it("sorts by column", async () => {
    const user = userEvent.setup();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    await user.click(screen.getByTestId("th-name"));
    const rowsEl = screen.getAllByTestId("row");
    expect(rowsEl[0]).toHaveTextContent("db1");
    await user.click(screen.getByTestId("th-name"));
    expect(screen.getAllByTestId("row")[0]).toHaveTextContent("web1");
  });

  it("selects rows and select-all", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} selectedKeys={[]} onSelectionChange={onSelectionChange} />);
    await user.click(screen.getAllByTestId("row-select")[0]!);
    expect(onSelectionChange).toHaveBeenCalledWith(["web1"]);
    await user.click(screen.getByTestId("select-all"));
    expect(onSelectionChange).toHaveBeenCalledWith(["web1", "db1"]);
  });

it("hides the checkbox column without selection", () => {
  render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
  expect(screen.queryByTestId("inert-checkbox")).not.toBeInTheDocument();
  expect(screen.queryByTestId("select-all")).not.toBeInTheDocument();
  expect(screen.queryByTestId("row-select")).not.toBeInTheDocument();
});

  it("shows empty message", () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.name} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("calls onRowClick", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} onRowClick={onRowClick} />);
    await user.click(within(screen.getAllByTestId("row")[0]!).getByText("web1"));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("sticks the header by default", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    expect(screen.getByTestId("th-name").className).toContain("sticky");
    expect(screen.getByTestId("th-status").className).toContain("sticky");
    expect(screen.getByTestId("th-name").style.top).toBe("0px");
  });

  it("applies a sticky header offset", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} stickyHeaderOffset={45} />);
    expect(screen.getByTestId("th-name").style.top).toBe("45px");
  });

  it("sticks the checkbox column when selection is enabled", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} selectedKeys={[]} onSelectionChange={vi.fn()} />);
    const selectAll = screen.getByTestId("select-all");
    expect(selectAll.closest("th")?.className).toContain("sticky");
  });

  it("can disable the sticky header", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} stickyHeader={false} />);
    expect(screen.getByTestId("th-name").className).not.toContain("sticky");
  });

  it("uses border-separate so sticky headers work in Chrome", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.name} />);
    const table = screen.getByTestId("table");
    expect(table.className).toContain("border-separate");
    expect(table.className).not.toContain("border-collapse");
  });
});
