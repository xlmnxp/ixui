import { createRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExplorerNavbar } from "./explorer-nav";
import { Button } from "./button";

describe("ExplorerNavbar", () => {
  const base = {
    cwd: "/srv/www",
    onBack: vi.fn(),
    onForward: vi.fn(),
    onUp: vi.fn(),
    onNavigate: vi.fn(),
    onCommitPath: vi.fn(),
  };

  it("renders breadcrumbs and enabled/disabled navigation", () => {
    render(<ExplorerNavbar {...base} canBack={false} canForward={true} />);
    expect(screen.getByTestId("crumb-root")).toHaveTextContent("/");
    expect(screen.getByTestId("crumb-0")).toHaveTextContent("srv");
    expect(screen.getByTestId("crumb-1")).toHaveTextContent("www");
    expect(screen.getByTestId("files-back")).toBeDisabled();
    expect(screen.getByTestId("files-forward")).toBeEnabled();
    expect(screen.getByTestId("files-up")).toBeEnabled();
  });

  it("disables Up at the root", () => {
    render(<ExplorerNavbar {...base} cwd="/" />);
    expect(screen.getByTestId("files-up")).toBeDisabled();
  });

  it("fires navigation handlers", async () => {
    const user = userEvent.setup();
    render(<ExplorerNavbar {...base} canBack={true} canForward={true} />);
    await user.click(screen.getByTestId("crumb-0"));
    expect(base.onNavigate).toHaveBeenCalledWith("/srv");
    await user.click(screen.getByTestId("crumb-root"));
    expect(base.onNavigate).toHaveBeenCalledWith("/");
    await user.click(screen.getByTestId("files-back"));
    expect(base.onBack).toHaveBeenCalled();
    await user.click(screen.getByTestId("files-forward"));
    expect(base.onForward).toHaveBeenCalled();
    await user.click(screen.getByTestId("files-up"));
    expect(base.onUp).toHaveBeenCalled();
  });

  it("click-to-edit prefills the current path", async () => {
    const user = userEvent.setup();
    render(<ExplorerNavbar {...base} />);
    await user.click(screen.getByTestId("files-breadcrumbs"));
    expect(screen.getByTestId("files-path-input")).toHaveValue("/srv/www");
  });

  it("commits a normalized path on Enter and closes the input", async () => {
    const user = userEvent.setup();
    render(<ExplorerNavbar {...base} />);
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "var/log{Enter}");
    await waitFor(() => expect(base.onCommitPath).toHaveBeenCalledWith("/var/log"));
    await waitFor(() => expect(screen.queryByTestId("files-path-input")).not.toBeInTheDocument());
  });

  it("keeps the input open with an inline error when commit rejects", async () => {
    const user = userEvent.setup();
    const onCommitPath = vi.fn().mockRejectedValue(new Error("Path not found: /nope"));
    render(<ExplorerNavbar {...base} onCommitPath={onCommitPath} />);
    await user.click(screen.getByTestId("files-breadcrumbs"));
    const input = screen.getByTestId("files-path-input");
    await user.clear(input);
    await user.type(input, "/nope{Enter}");
    expect(await screen.findByTestId("files-path-error")).toHaveTextContent("Path not found: /nope");
    expect(screen.getByTestId("files-path-input")).toBeInTheDocument();
    expect(screen.getByTestId("files-path-input").className).toContain("border-danger");
    expect(screen.getByTestId("files-path-input")).toHaveAttribute("aria-invalid", "true");
  });

  it("escape cancels editing", async () => {
    const user = userEvent.setup();
    render(<ExplorerNavbar {...base} />);
    await user.click(screen.getByTestId("files-breadcrumbs"));
    await user.type(screen.getByTestId("files-path-input"), "{Escape}");
    expect(screen.queryByTestId("files-path-input")).not.toBeInTheDocument();
    expect(screen.getByTestId("files-breadcrumbs")).toBeInTheDocument();
  });

  it("renders actions and the sticky variant", () => {
    const { rerender } = render(
      <ExplorerNavbar {...base} actions={<Button size="sm" data-testid="demo-action">Do</Button>} />
    );
    expect(screen.getByTestId("demo-action")).toBeInTheDocument();
    expect(screen.getByTestId("files-navbar").className).toContain("sticky");
    rerender(<ExplorerNavbar {...base} sticky={false} />);
    expect(screen.getByTestId("files-navbar").className).not.toContain("sticky");
  });

  it("forwards rootRef to the sticky root element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ExplorerNavbar {...base} rootRef={ref} />);
    expect(ref.current).toBe(screen.getByTestId("files-navbar"));
  });
});
