import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyValueEditor } from "./key-value-editor";

vi.mock("../api", () => ({
  serverApi: {
    metadata: vi.fn().mockResolvedValue({
      configs: {
        instance: {
          instance: {
            keys: [
              { "limits.memory": { shortdesc: "Memory limit in bytes", type: "integer" } },
              { "boot.autostart": { shortdesc: "Start on boot", type: "bool" } },
            ],
          },
        },
      },
    }),
  },
}));

function Editable({ onChange }: { onChange: (values: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>({ key1: "a" });
  return <KeyValueEditor values={values} onChange={(next) => { setValues(next); onChange(next); }} />;
}

describe("KeyValueEditor", () => {
  it("renders entries", () => {
    render(<KeyValueEditor values={{ "limits.memory": "512MiB" }} onChange={() => {}} />);
    expect(screen.getByTestId("kv-key-limits.memory")).toHaveTextContent("limits.memory");
    expect(screen.getByTestId("kv-value-limits.memory")).toHaveTextContent("512MiB");
  });

  it("renders the description under the key from the descriptions prop", () => {
    render(
      <KeyValueEditor
        values={{ "limits.memory": "512MiB" }}
        onChange={() => {}}
        descriptions={{ "limits.memory": "Memory limit in bytes" }}
      />
    );
    expect(screen.getByTestId("kv-desc-limits.memory")).toHaveTextContent("Memory limit in bytes");
    expect(screen.getByTestId("kv-desc-limits.memory")).toBeInTheDocument();
    // The description lives in the key cell.
    expect(screen.getByTestId("kv-key-limits.memory")).toHaveTextContent("Memory limit in bytes");
  });

  it("loads descriptions from the metadata API when none are provided", async () => {
    render(<KeyValueEditor values={{ "limits.memory": "512MiB" }} onChange={() => {}} />);
    expect(await screen.findByTestId("kv-desc-limits.memory")).toHaveTextContent("Memory limit in bytes");
  });

  it("suggests known keys with search while typing a new key", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{}} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-add"));
    await user.type(screen.getByTestId("kv-key-edit-"), "limit");
    expect(screen.getByTestId("kv-suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("kv-suggest-limits.memory")).toBeInTheDocument();
    await user.click(screen.getByTestId("kv-suggest-limits.memory"));
    expect(screen.getByTestId("kv-key-edit-")).toHaveValue("limits.memory");
    expect(screen.getByTestId("kv-key-hint")).toHaveTextContent("Memory limit in bytes");
    expect(screen.getByTestId("kv-key-hint")).toHaveTextContent("integer");
  });

  it("selects suggestions with the keyboard", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{}} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-add"));
    const keyInput = screen.getByTestId("kv-key-edit-");
    await user.type(keyInput, "boot");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByTestId("kv-key-edit-")).toHaveValue("boot.autostart");
  });

  it("presets true and renders a switch for bool keys", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{}} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-add"));
    await user.type(screen.getByTestId("kv-key-edit-"), "boot");
    await user.click(screen.getByTestId("kv-suggest-boot.autostart"));
    const switchEl = screen.getByTestId("kv-bool-switch");
    expect(switchEl).toHaveAttribute("aria-checked", "true");
    await user.click(switchEl);
    expect(screen.getByTestId("kv-bool-switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByTestId("kv-value-edit-")).not.toBeInTheDocument();
  });

  it("renders bool values as badges in display mode", async () => {
    render(<KeyValueEditor values={{ "boot.autostart": "true" }} onChange={() => {}} />);
    const cell = await screen.findByTestId("kv-value-boot.autostart");
    const badge = cell.querySelector('[data-testid="badge"]');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("true");
    expect(badge?.className).toContain("green");
  });

  it("opens the suggestion dropdown upward when there is no room below", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{}} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-add"));
    const keyInput = screen.getByTestId("kv-key-edit-");
    vi.spyOn(keyInput, "getBoundingClientRect").mockReturnValue({
      bottom: window.innerHeight - 4,
      top: window.innerHeight - 120,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    await user.type(keyInput, "boot");
    const dropdown = await screen.findByTestId("kv-suggestions");
    expect(dropdown.className).toContain("bottom-full");
    expect(dropdown.className).not.toContain("top-full");
  });

  it("keeps the header non-sticky by default", () => {
    render(<KeyValueEditor values={{ a: "1" }} onChange={() => {}} />);
    const editor = screen.getByTestId("kv-editor");
    const table = editor.querySelector("table");
    expect(table?.className).toContain("border-collapse");
    for (const th of table?.querySelectorAll("thead > tr > th") ?? []) {
      expect(th.className).not.toContain("sticky");
    }
  });

  it("sticks the header when stickyHeader is set", () => {
    render(<KeyValueEditor values={{ a: "1" }} onChange={() => {}} stickyHeader />);
    const editor = screen.getByTestId("kv-editor");
    const table = editor.querySelector("table");
    expect(table?.className).toContain("border-separate");
    for (const th of table?.querySelectorAll("thead > tr > th") ?? []) {
      expect(th.className).toContain("sticky");
      expect(th.className).toContain("bg-surface-700");
    }
  });

  it("edits values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Editable onChange={onChange} />);
    await user.dblClick(screen.getByTestId("kv-value-key1"));
    const input = screen.getByTestId("kv-value-edit-key1");
    await user.clear(input);
    await user.type(input, "b");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ key1: "b" });
  });

  it("removes entries", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    await user.click(screen.getByTestId("kv-remove"));
    expect(onChange).toHaveBeenCalledWith({ key2: "b" });
  });

  it("adds an unfilled row in edit mode with the key preselected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-add"));
    expect(onChange).toHaveBeenCalledWith({ key1: "a", "": "" });
    const keyInput = screen.getByTestId("kv-key-edit-") as HTMLInputElement;
    await waitFor(() => expect(keyInput).toHaveFocus());
    expect(keyInput.value).toBe("");
    await user.type(keyInput, "custom");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ key1: "a", custom: "" });
  });

  it("removes a newly created row on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-add"));
    await user.keyboard("{Escape}");
    expect(onChange).toHaveBeenLastCalledWith({ key1: "a" });
    expect(screen.queryByTestId("kv-row-")).not.toBeInTheDocument();
  });

  it("does not overwrite an existing key when renaming onto it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.dblClick(screen.getByTestId("kv-key-key1"));
    const input = screen.getByTestId("kv-key-edit-key1");
    await user.clear(input);
    await user.type(input, "key2");
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("edits a value inline on double-click", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={() => {}} />);
    await user.dblClick(screen.getByTestId("kv-value-key1"));
    const input = screen.getByTestId("kv-value-edit-key1");
    await user.clear(input);
    await user.type(input, "b");
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("kv-value-key1")).toHaveTextContent("b");
  });

  it("edits key and value via select + Edit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    expect(screen.getByTestId("kv-edit")).toBeEnabled();
    await user.click(screen.getByTestId("kv-edit"));
    const keyInput = screen.getByTestId("kv-key-edit-key1");
    const valueInput = screen.getByTestId("kv-value-edit-key1");
    await user.clear(keyInput);
    await user.type(keyInput, "key2");
    await user.clear(valueInput);
    await user.type(valueInput, "b");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ key2: "b" });
  });

  it("retargets the selection after a rename so Remove deletes the renamed row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Editable onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    await user.click(screen.getByTestId("kv-edit"));
    const keyInput = screen.getByTestId("kv-key-edit-key1");
    await user.clear(keyInput);
    await user.type(keyInput, "key2");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ key2: "a" });
    expect(screen.getByTestId("kv-check-key2")).toBeChecked();
    expect(screen.getByTestId("kv-remove")).toBeEnabled();
    await user.click(screen.getByTestId("kv-remove"));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it("removes the selected row via the Remove button", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    await user.click(screen.getByTestId("kv-remove"));
    expect(onChange).toHaveBeenCalledWith({ key2: "b" });
  });

  it("selects rows via checkboxes (multi-select) and removes all selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    await user.click(screen.getByTestId("kv-check-key2"));
    await user.click(screen.getByTestId("kv-remove"));
    expect(onChange).toHaveBeenCalledWith({});
  });

  it("edits the first selected row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={onChange} />);
    await user.click(screen.getByTestId("kv-check-key1"));
    await user.click(screen.getByTestId("kv-check-key2"));
    await user.click(screen.getByTestId("kv-edit"));
    expect(screen.getByTestId("kv-key-edit-key1")).toBeInTheDocument();
    await user.clear(screen.getByTestId("kv-key-edit-key1"));
    await user.type(screen.getByTestId("kv-key-edit-key1"), "key3");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({ key3: "a", key2: "b" });
  });

  it("select-all checks every row", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-select-all"));
    expect(screen.getByTestId("kv-check-key1")).toBeChecked();
    expect(screen.getByTestId("kv-check-key2")).toBeChecked();
  });

  it("select-all includes the description row", async () => {
    const user = userEvent.setup();
    render(<KeyValueEditor values={{ key1: "a" }} description="A description" onDescriptionChange={() => {}} onChange={() => {}} />);
    await user.click(screen.getByTestId("kv-select-all"));
    expect(screen.getByTestId("kv-check-key1")).toBeChecked();
    expect(screen.getByTestId("kv-check-Description")).toBeChecked();
  });

  it("renders descriptions as helper text under the key", () => {
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} descriptions={{ key1: "Memory limit" }} onChange={() => {}} />);
    expect(screen.getByText("Memory limit")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    expect(screen.getByTestId("kv-key-key1")).toHaveTextContent("Memory limit");
    expect(screen.getByTestId("kv-value-key1")).not.toHaveTextContent("Memory limit");
  });
});
