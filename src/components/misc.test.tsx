import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./tabs";
import { Breadcrumbs } from "./breadcrumbs";
import { Progress } from "./progress";

describe("Tabs", () => {
  it("switches active tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={[{ key: "overview", label: "Overview" }, { key: "logs", label: "Logs" }]} active="overview" onChange={onChange} />);
    await user.click(screen.getByTestId("tab-logs"));
    expect(onChange).toHaveBeenCalledWith("logs");
    expect(screen.getByTestId("tab-overview")).toHaveAttribute("aria-selected", "true");
  });
});

describe("Breadcrumbs", () => {
  it("renders crumb trail", () => {
    render(
      <MemoryRouter>
        <Breadcrumbs items={[{ label: "Instances", to: "/instances" }, { label: "web1" }]} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("Instances");
    expect(screen.getByTestId("breadcrumbs")).toHaveTextContent("web1");
  });
});

describe("Progress", () => {
  it("renders determinate width", () => {
    render(<Progress value={42} />);
    expect(screen.getByRole("progressbar")).toHaveStyle({ width: undefined });
    expect(screen.getByTestId("progress").querySelector("div")).toHaveStyle({ width: "42%" });
  });

  it("clamps value to 100", () => {
    render(<Progress value={150} />);
    expect(screen.getByTestId("progress").querySelector("div")).toHaveStyle({ width: "100%" });
  });
});
