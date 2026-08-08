import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";

describe("Input", () => {
  it("renders label and value", () => {
    render(<Input label="Name" name="name" defaultValue="web1" />);
    expect(screen.getByLabelText("Name")).toHaveValue("web1");
  });

  it("shows error", () => {
    render(<Input name="name" error="Invalid name" />);
    expect(screen.getByText("Invalid name")).toBeInTheDocument();
    expect(screen.getByLabelText("Invalid name")).toHaveClass("border-danger");
  });
});

describe("Select", () => {
  it("selects an option", async () => {
    const user = userEvent.setup();
    render(
      <Select label="Type" name="type">
        <option value="container">Container</option>
        <option value="virtual-machine">VM</option>
      </Select>
    );
    const select = screen.getByLabelText("Type");
    await user.selectOptions(select, "virtual-machine");
    expect(select).toHaveValue("virtual-machine");
  });
});

describe("Textarea", () => {
  it("renders value", () => {
    render(<Textarea label="Notes" name="notes" defaultValue="hello" />);
    expect(screen.getByLabelText("Notes")).toHaveValue("hello");
  });
});

describe("Checkbox", () => {
  it("toggles checked", async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Ephemeral" defaultChecked={false} />);
    const box = screen.getByRole("checkbox");
    await user.click(box);
    expect(box).toBeChecked();
  });
});

describe("Switch", () => {
  it("toggles on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Auto start" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
