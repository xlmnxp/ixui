import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * While `active`, keep Tab focus inside `ref`, move focus into it on open
 * (unless something inside already has it, e.g. an autofocus input), and
 * restore focus to the previously focused element on close.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = ref.current;
    if (container && !container.contains(document.activeElement)) {
      (container.querySelector<HTMLElement>(FOCUSABLE) ?? container).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey && (current === first || !el.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !el.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [ref, active]);
}
