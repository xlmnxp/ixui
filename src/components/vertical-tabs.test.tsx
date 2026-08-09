import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerticalTabs } from "./vertical-tabs";

describe("VerticalTabs", () => {
  const tabs = [
    { key: "instances", label: "Instances" },
    { key: "images", label: "Images" },
  ];

  it("renders tabs with active state", () => {
    render(<VerticalTabs tabs={tabs} active="images" onChange={() => {}} />);
    expect(screen.getByTestId("vertical-tabs")).toBeInTheDocument();
    expect(screen.getByTestId("vtab-instances")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByTestId("vtab-images")).toHaveAttribute("aria-selected", "true");
  });

  it("switches on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VerticalTabs tabs={tabs} active="instances" onChange={onChange} />);
    await user.click(screen.getByTestId("vtab-images"));
    expect(onChange).toHaveBeenCalledWith("images");
  });

  it("renders icons when provided", () => {
    render(<VerticalTabs tabs={[{ key: "a", label: "A", icon: <span data-testid="icon-a" /> }]} active="a" onChange={() => {}} />);
    expect(screen.getByTestId("icon-a")).toBeInTheDocument();
  });
});
