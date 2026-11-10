import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useFocusTrap } from "../lib/use-focus-trap";
import { useUnsavedGuard } from "../lib/use-unsaved-guard";
import { ConfirmDialog } from "./confirm-dialog";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Render a wider dialog (for table-heavy editors). */
  wide?: boolean;
  /** Explicit width tier; `wide` is kept as an alias for "wide". */
  size?: "default" | "wide" | "xl";
  /** Unsaved edits: backdrop, Escape and the close button ask before discarding. */
  dirty?: boolean;
  /** Copy for the confirmation prompt. */
  discardMessage?: string;
  /** Close handler that honours the unsaved guard (use for footer buttons). */
  renderFooter?: (close: () => void) => ReactNode;
}

const SIZE_CLASS: Record<"default" | "wide" | "xl", string> = {
  default: "max-w-lg max-h-[80vh]",
  wide: "max-w-5xl max-h-[80vh]",
  xl: "max-w-7xl max-h-[88vh]",
};

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  size,
  dirty = false,
  discardMessage = "You have unsaved changes. Discard them?",
  renderFooter,
}: DialogProps) {
  const tier = size ?? (wide ? "wide" : "default");
  const panelRef = useRef<HTMLDivElement>(null);
  const guard = useUnsavedGuard(dirty, onClose);
  useFocusTrap(panelRef, open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") guard.requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, guard]);

  if (!open) return null;

  const footerNode = renderFooter ? renderFooter(guard.requestClose) : footer;

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} data-testid="dialog">
        <div className="absolute inset-0 bg-black/60" data-testid="dialog-backdrop" onClick={guard.requestClose} />
        <div ref={panelRef} tabIndex={-1} className={`relative w-full overflow-auto rounded-lg border border-border bg-surface-800 p-5 shadow-xl outline-none ${SIZE_CLASS[tier]}`}>
          <h2 className="mb-3 text-base font-semibold text-text-primary">{title}</h2>
          <div className="text-sm text-text-secondary">{children}</div>
          {footerNode && <div className="mt-5 flex justify-end gap-2">{footerNode}</div>}
        </div>
      </div>
      <ConfirmDialog
        open={guard.asking}
        title="Discard changes?"
        body={discardMessage}
        confirmLabel="Discard"
        tone="danger"
        onConfirm={guard.discard}
        onCancel={guard.cancel}
      />
    </>,
    document.body
  );
}
