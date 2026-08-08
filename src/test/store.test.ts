import { renderHook, act } from "@testing-library/react";
import { createStore, useStore } from "../state/store";

describe("createStore", () => {
  it("returns the initial state", () => {
    const store = createStore(0);
    expect(store.getState()).toBe(0);
  });

  it("updates state with a value", () => {
    const store = createStore(0);
    store.setState(5);
    expect(store.getState()).toBe(5);
  });

  it("updates state with a function", () => {
    const store = createStore(0);
    store.setState((prev) => prev + 1);
    expect(store.getState()).toBe(1);
  });

  it("notifies subscribers", () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener);
    store.setState(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes", () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.setState(1);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("useStore", () => {
  it("re-renders with new state", () => {
    const store = createStore(0);
    const { result } = renderHook(() => useStore(store));
    expect(result.current).toBe(0);
    act(() => store.setState(3));
    expect(result.current).toBe(3);
  });
});
