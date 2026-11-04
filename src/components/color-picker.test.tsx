import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPicker } from "./color-picker";

function Controlled({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ColorPicker value={value} onChange={setValue} dataTestId="cp" />;
}

describe("ColorPicker", () => {
  it("marks the selected swatch with a theme-aware ring", () => {
    render(<ColorPicker value="#58a6ff" onChange={() => {}} dataTestId="cp" />);
    const selected = screen.getByTestId("cp-#58a6ff");
    expect(selected).toHaveAttribute("aria-pressed", "true");
    // Uses a themed token so the ring stays visible in light and dark themes.
    expect(selected.className).toContain("border-text-primary");
    expect(selected.className).not.toContain("border-white");

    const other = screen.getByTestId("cp-#3fb950");
    expect(other).toHaveAttribute("aria-pressed", "false");
    expect(other.className).toContain("border-transparent");
  });

  it("selects a color and deselects it on a second click", async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(screen.getByTestId("cp-#3fb950"));
    expect(screen.getByTestId("cp-#3fb950")).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByTestId("cp-#3fb950"));
    expect(screen.getByTestId("cp-#3fb950")).toHaveAttribute("aria-pressed", "false");
  });

  it("marks the none option as pressed when no color is set", () => {
    render(<ColorPicker value="" onChange={() => {}} dataTestId="cp" />);
    const none = screen.getByTestId("cp-none");
    expect(none).toHaveAttribute("aria-pressed", "true");
    expect(none.className).toContain("border-text-primary");
  });
});
