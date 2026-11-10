import { act, renderHook } from "@testing-library/react";
import { useUnsavedGuard } from "./use-unsaved-guard";

describe("useUnsavedGuard", () => {
  it("closes straight away when the form is clean", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedGuard(false, onClose));
    act(() => result.current.requestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.asking).toBe(false);
  });

  it("asks before closing when the form is dirty", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedGuard(true, onClose));
    act(() => result.current.requestClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.asking).toBe(true);
  });

  it("discards on confirm and stays on cancel", () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useUnsavedGuard(true, onClose));
    act(() => result.current.requestClose());
    act(() => result.current.cancel());
    expect(result.current.asking).toBe(false);
    expect(onClose).not.toHaveBeenCalled();

    act(() => result.current.requestClose());
    act(() => result.current.discard());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(result.current.asking).toBe(false);
  });
});
