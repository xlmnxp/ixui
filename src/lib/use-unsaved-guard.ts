import { useCallback, useState } from "react";

export interface UnsavedGuard {
  /** True while the confirm prompt is showing. */
  asking: boolean;
  /** Call instead of onClose: closes immediately when clean, asks when dirty. */
  requestClose: () => void;
  /** Discard and close. */
  discard: () => void;
  /** Keep editing. */
  cancel: () => void;
}

/**
 * Guard an editor's close path so unsaved edits are not thrown away silently.
 *
 * `dirty` should report whether the form differs from what was loaded; when it
 * is false the guard is transparent and closing needs no confirmation.
 */
export function useUnsavedGuard(dirty: boolean, onClose: () => void): UnsavedGuard {
  const [asking, setAsking] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);

  const discard = useCallback(() => {
    setAsking(false);
    onClose();
  }, [onClose]);

  const cancel = useCallback(() => setAsking(false), []);

  return { asking, requestClose, discard, cancel };
}
