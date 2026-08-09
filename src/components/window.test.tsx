import { render, screen, fireEvent } from "@testing-library/react";
import { Window } from "./window";

describe("Window", () => {
  it("renders nothing when closed", () => {
    render(<Window open={false} onClose={() => {}} title="T">x</Window>);
    expect(screen.queryByTestId("window")).not.toBeInTheDocument();
  });

  it("renders title, children, and footer", () => {
    render(
      <Window open onClose={() => {}} title="Create instance" footer={<button>Go</button>}>
        <p>body</p>
      </Window>
    );
    expect(screen.getByRole("dialog", { name: "Create instance" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    render(<Window open onClose={onClose} title="T">x</Window>);
    fireEvent.click(screen.getByTestId("window-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Window open onClose={onClose} title="T">x</Window>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drags the window via the header", () => {
    render(<Window open onClose={() => {}} title="T">x</Window>);
    const header = screen.getByTestId("window-drag");
    const panel = screen.getByTestId("window");
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 120 });
    fireEvent.pointerUp(window);
    expect(panel).toHaveStyle({ transform: "translate(50px, 20px)" });
  });

  it("clamps drag to the centered viewport range", () => {
    render(<Window open onClose={() => {}} title="T">x</Window>);
    const header = screen.getByTestId("window-drag");
    const panel = screen.getByTestId("window");
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 5000, clientY: 5000 });
    expect(panel).toHaveStyle({ transform: "translate(192px, 124px)" });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(header, { clientX: 400, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
    expect(panel).toHaveStyle({ transform: "translate(-192px, -124px)" });
  });
});
