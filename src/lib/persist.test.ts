import { act, renderHook } from "@testing-library/react";
import { readPersisted, usePersistedState, writePersisted } from "./persist";

const isNum = (v: unknown): v is number => typeof v === "number";

describe("persist", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips values and rejects invalid ones", () => {
    writePersisted("a", 5);
    expect(readPersisted("a", 1, isNum)).toBe(5);
    writePersisted("a", "nope");
    expect(readPersisted("a", 1, isNum)).toBe(1);
  });

  it("falls back when storage throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPersisted("a", 7, isNum)).toBe(7);
    spy.mockRestore();
  });

  it("usePersistedState saves only when keyed", () => {
    const { result } = renderHook(() => usePersistedState("k", 1, isNum));
    act(() => result.current[1](9));
    expect(window.localStorage.getItem("ixui.ui.k")).toBe("9");
    const { result: plain } = renderHook(() => usePersistedState(undefined, 1, isNum));
    act(() => plain.current[1](3));
    expect(plain.current[0]).toBe(3);
    expect(window.localStorage.getItem("ixui.ui.undefined")).toBeNull();
  });
});
