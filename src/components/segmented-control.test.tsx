import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./segmented-control";

const OPTIONS = [
  { value: "container" as const, label: "Container" },
  { value: "virtual-machine" as const, label: "Virtual machine" },
];

function Harness() {
  const [value, setValue] = useState<"container" | "virtual-machine">("container");
  return (
    <SegmentedControl
      label="Type"
      value={value}
      options={OPTIONS}
      onChange={setValue}
      dataTestId="sc"
    />
  );
}

describe("SegmentedControl", () => {
  it("renders a labelled group with the current option checked", () => {
    render(<Harness />);
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-label", "Type");
    expect(screen.getByTestId("sc-container")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("sc-virtual-machine")).toHaveAttribute("aria-checked", "false");
  });

  it("selects another option on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByTestId("sc-virtual-machine"));
    expect(screen.getByTestId("sc-virtual-machine")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("sc-container")).toHaveAttribute("aria-checked", "false");
  });
});
