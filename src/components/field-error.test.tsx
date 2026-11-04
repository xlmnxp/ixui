import { render, screen } from "@testing-library/react";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

describe("field error states", () => {
  it("renders the input error as a chip attached under the field", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} error="Enter an instance name" />);
    const input = screen.getByTestId("input");
    const chip = screen.getByTestId("input-error");
    expect(chip).toHaveTextContent("Enter an instance name");
    expect(chip).toHaveAttribute("role", "alert");
    // One control: the field drops its bottom edge, the chip drops its top edge,
    // and they sit in a zero-gap column so nothing separates them.
    expect(chip.className).toContain("rounded-b");
    expect(chip.className).toContain("border-t-0");
    expect(input.className).toContain("rounded-t");
    expect(input.className).toContain("border-b-0");
    expect(chip.parentElement).toBe(input.parentElement);
    expect(chip.parentElement?.className).toBe("flex flex-col");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "n-error");
  });

  it("omits the chip and keeps full rounding without an error", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} />);
    expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
    const input = screen.getByTestId("input");
    expect(input.className).toContain("rounded ");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("supports the same error chip on select and textarea", () => {
    render(
      <>
        <Select label="Project" name="p" error="Pick a project">
          <option value="a">a</option>
        </Select>
        <Textarea label="Notes" name="t" error="Too long" />
      </>
    );
    expect(screen.getByTestId("select-error")).toHaveTextContent("Pick a project");
    expect(screen.getByTestId("textarea-error")).toHaveTextContent("Too long");
    expect(screen.getByTestId("select").className).toContain("rounded-t");
    expect(screen.getByTestId("textarea").className).toContain("rounded-t");
  });
});
