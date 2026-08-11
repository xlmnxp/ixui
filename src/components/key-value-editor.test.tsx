import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyValueEditor } from "./key-value-editor";

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

  it("renders descriptions as helper text under the value", () => {
    render(<KeyValueEditor values={{ key1: "a", key2: "b" }} descriptions={{ key1: "Memory limit" }} onChange={() => {}} />);
    expect(screen.getByText("Memory limit")).toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    expect(screen.getByTestId("kv-value-key1")).toHaveTextContent("aMemory limit");
  });
});
