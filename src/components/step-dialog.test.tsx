import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ReviewList, StepDialog } from "./step-dialog";

function Host({ onSubmit = vi.fn(), free = false }: { onSubmit?: () => void; free?: boolean }) {
  const [name, setName] = useState("");
  return (
    <StepDialog
      open
      onClose={() => {}}
      title="Create thing"
      freeNavigation={free}
      onSubmit={onSubmit}
      submitLabel="Create"
      steps={[
        { key: "basics", title: "Basics", invalid: name.trim() ? null : "Name is required", content: <input aria-label="name" value={name} onChange={(e) => setName(e.target.value)} /> },
        { key: "extra", title: "Extra", content: <p>extra step</p> },
        { key: "review", title: "Review", content: <ReviewList rows={[{ label: "Name", value: name }]} /> },
      ]}
    />
  );
}

describe("StepDialog", () => {
  it("blocks Next until the step is valid, then walks through to submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Host onSubmit={onSubmit} />);
    expect(screen.getByTestId("step-next")).toBeDisabled();
    expect(screen.getByTestId("step-hint")).toHaveTextContent("Name is required");
    await user.type(screen.getByLabelText("name"), "web");
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByText("extra step")).toBeInTheDocument();
    await user.click(screen.getByTestId("step-next"));
    expect(screen.getByTestId("review-list")).toHaveTextContent("web");
    await user.click(screen.getByTestId("step-submit"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("goes back and keeps entered values", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.type(screen.getByLabelText("name"), "web");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-back"));
    expect(screen.getByLabelText("name")).toHaveValue("web");
  });

  it("only allows jumping forward through valid, visited steps in create mode", async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByTestId("step-tab-review")).toBeDisabled();
    await user.type(screen.getByLabelText("name"), "a");
    expect(screen.getByTestId("step-tab-extra")).toBeEnabled();
    expect(screen.getByTestId("step-tab-review")).toBeDisabled();
  });

  it("lets edit flows jump to any step once earlier steps are valid", async () => {
    const user = userEvent.setup();
    render(<Host free />);
    await user.type(screen.getByLabelText("name"), "a");
    expect(screen.getByTestId("step-tab-review")).toBeEnabled();
    await user.click(screen.getByTestId("step-tab-review"));
    expect(screen.getByTestId("step-submit")).toBeEnabled();
  });

  it("disables submit and explains when an earlier step becomes invalid", async () => {
    const user = userEvent.setup();
    render(<Host free />);
    await user.type(screen.getByLabelText("name"), "a");
    await user.click(screen.getByTestId("step-tab-review"));
    await user.click(screen.getByTestId("step-tab-basics"));
    await user.clear(screen.getByLabelText("name"));
    expect(screen.getByTestId("step-tab-review")).toBeDisabled();
  });

  it("shows progress ticks while creating but not while editing", async () => {
    const user = userEvent.setup();
    const tick = () => document.querySelectorAll('[data-testid="stepper"] svg').length;

    const { unmount } = render(<Host />);
    await user.type(screen.getByLabelText("name"), "a");
    await user.click(screen.getByTestId("step-next"));
    expect(tick()).toBe(1);
    unmount();

    render(<Host free />);
    await user.type(screen.getByLabelText("name"), "a");
    await user.click(screen.getByTestId("step-next"));
    await user.click(screen.getByTestId("step-tab-basics"));
    await user.click(screen.getByTestId("step-tab-review"));
    expect(tick()).toBe(0);
  });

  it("flags a later step that needs attention in edit mode", () => {
    render(
      <StepDialog
        open
        onClose={() => {}}
        title="Edit"
        freeNavigation
        onSubmit={() => {}}
        steps={[
          { key: "a", title: "A", content: <p>a</p> },
          { key: "b", title: "B", invalid: "Fix B", content: <p>b</p> },
        ]}
      />,
    );
    expect(screen.getByLabelText("Needs attention")).toBeInTheDocument();
  });

  it("uses a save icon, not a checkmark, on the final edit button", async () => {
    const user = userEvent.setup();
    render(<Host free />);
    await user.type(screen.getByLabelText("name"), "a");
    await user.click(screen.getByTestId("step-tab-review"));
    expect(screen.getByTestId("step-submit").querySelector("svg.lucide-save")).not.toBeNull();
    expect(screen.getByTestId("step-submit").querySelector("svg.lucide-check")).toBeNull();
  });

  it("gives Cancel, Back and the primary action three distinct styles", async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.type(screen.getByLabelText("name"), "a");
    await user.click(screen.getByTestId("step-next"));
    const cancel = screen.getByTestId("step-cancel").className;
    const back = screen.getByTestId("step-back").className;
    const next = screen.getByTestId("step-next").className;
    expect(new Set([cancel, back, next]).size).toBe(3);
    expect(next).toContain("bg-accent-600");
    expect(back).toContain("border");
    expect(cancel).not.toContain("border");
    expect(cancel).not.toMatch(/(^|\s)bg-/);
  });

  it("puts Cancel apart from Back/Next", async () => {
    render(<Host />);
    const cancel = screen.getByTestId("step-cancel");
    const next = screen.getByTestId("step-next");
    expect(cancel.parentElement).not.toBe(next.parentElement);
  });
});
