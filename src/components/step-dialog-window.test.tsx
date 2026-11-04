import { render, screen } from "@testing-library/react";
import { StepDialog } from "./step-dialog";

const steps = [{ key: "one", title: "One", content: <p>first</p> }];

describe("StepDialog window mode", () => {
  it("renders inside the draggable Window shell when requested", () => {
    render(
      <StepDialog
        open
        onClose={() => {}}
        title="Create instance"
        steps={steps}
        onSubmit={() => {}}
        windowMode
        windowWidth={1120}
      />
    );
    const shell = screen.getByTestId("window");
    expect(shell).toBeInTheDocument();
    // Stepper and footer live inside the window.
    expect(screen.getByTestId("stepper")).toBeInTheDocument();
    expect(screen.getByTestId("step-cancel")).toBeInTheDocument();
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("keeps the plain dialog shell by default", () => {
    render(<StepDialog open onClose={() => {}} title="Edit" steps={steps} onSubmit={() => {}} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("window")).not.toBeInTheDocument();
  });
});
