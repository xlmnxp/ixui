import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dropdown } from "./dropdown";

describe("Dropdown", () => {
  it("shows the selected option and selects from the menu", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Dropdown
        value="allow"
        onChange={onChange}
        dataTestId="dd"
        options={[
          { value: "allow", label: "allow" },
          { value: "drop", label: "drop" },
          { value: "reject", label: "reject", danger: true },
        ]}
      />
    );
    expect(screen.getByTestId("dd")).toHaveTextContent("allow");
    await user.click(screen.getByTestId("dd"));
    expect(screen.getByTestId("dd-drop")).toBeInTheDocument();
    await user.click(screen.getByTestId("dd-reject"));
    expect(onChange).toHaveBeenCalledWith("reject");
  });

  it("closes on outside click", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button data-testid="outside">outside</button>
        <Dropdown value="allow" onChange={() => {}} dataTestId="dd" options={[{ value: "allow", label: "allow" }]} />
      </div>
    );
    await user.click(screen.getByTestId("dd"));
    expect(screen.getByTestId("dd-allow")).toBeInTheDocument();
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByTestId("dd-allow")).not.toBeInTheDocument();
  });
});
