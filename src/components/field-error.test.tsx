import { render, screen } from "@testing-library/react";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";

describe("field error states", () => {
  it("keeps the field's own border and radius and tints it red", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} error="Enter an instance name" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("rounded");
    expect(input.className).toContain("border");
    expect(input.className).toContain("border-danger");
    // The field is never split: no suppressed edges.
    expect(input.className).not.toContain("border-b-0");
    expect(input.className).not.toContain("rounded-t");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "n-error");
  });

  it("renders the message attached under the field, borderless and inset", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} error="Enter an instance name" />);
    const input = screen.getByTestId("input");
    const chip = screen.getByTestId("input-error");
    expect(chip).toHaveTextContent("Enter an instance name");
    expect(chip).toHaveAttribute("role", "alert");
    // Attached: same zero-gap column as the field, no vertical spacing between them.
    expect(chip.parentElement).toBe(input.parentElement);
    expect(chip.parentElement?.className).toBe("flex flex-col");
    // Inset from the sides, tinted, no outline of its own, animated in.
    expect(chip.className).toContain("mx-1");
    expect(chip.className).not.toContain("border");
    expect(chip.className).toContain("bg-danger/10");
    expect(chip.className).toContain("field-error-in");
    // The border colour eases into red rather than snapping.
    expect(input.className).toContain("transition-colors");
  });

  it("omits the message without an error", () => {
    render(<Input label="Name" name="n" value="" onChange={() => {}} />);
    expect(screen.queryByTestId("input-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("input").className).toContain("border-border");
    expect(screen.getByTestId("input")).not.toHaveAttribute("aria-invalid");
  });

  it("applies the same treatment to select and textarea", () => {
    render(
      <>
        <Select label="Project" name="p" error="Pick a project">
          <option value="a">a</option>
        </Select>
        <Textarea label="Notes" name="t" error="Too long" />
      </>
    );
    for (const [field, message] of [["select", "select-error"], ["textarea", "textarea-error"]] as const) {
      const element = screen.getByTestId(field);
      expect(element.className).toContain("border-danger");
      expect(element.className).toContain("rounded");
      const chip = screen.getByTestId(message);
      expect(chip.className).toContain("mx-1");
      expect(chip.className).not.toContain("border");
    }
  });
});
