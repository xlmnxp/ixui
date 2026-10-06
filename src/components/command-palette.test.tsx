import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./command-palette";

const make = () => {
  const run = vi.fn();
  const onClose = vi.fn();
  const commands = [
    { id: "a", group: "Go to", label: "Settings", icon: "settings" as const, run },
    { id: "b", group: "Instances", label: "web1", hint: "default · Running", instance: { status: "Running" as const, type: "container" as const }, run: vi.fn() },
  ];
  render(<CommandPalette open onClose={onClose} commands={commands} />);
  return { run, onClose, commands };
};

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(<CommandPalette open={false} onClose={() => {}} commands={[]} />);
    expect(screen.queryByTestId("command-palette")).toBeNull();
  });

  it("filters, navigates with arrows, and runs on Enter", async () => {
    const { commands, onClose } = make();
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "web");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await userEvent.keyboard("{Enter}");
    expect(commands[1]!.run).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("moves selection with ArrowDown and closes on Escape", async () => {
    const { run, onClose } = make();
    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(run).toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders an icon for every result", () => {
    make();
    expect(screen.getAllByTestId("palette-icon")).toHaveLength(2);
  });

  it("shows an empty state", async () => {
    make();
    await userEvent.type(screen.getByRole("combobox"), "zzzz");
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});
