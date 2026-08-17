import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Render a wider dialog (for table-heavy editors). */
  wide?: boolean;
}

export function Dialog({ open, onClose, title, children, footer, wide = false }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title} data-testid="dialog">
      <div className="absolute inset-0 bg-black/60" data-testid="dialog-backdrop" onClick={onClose} />
      <div className={`relative max-h-[80vh] w-full ${wide ? "max-w-5xl" : "max-w-lg"} overflow-auto rounded-lg border border-border bg-surface-800 p-5 shadow-xl`}>
        <h2 className="mb-3 text-base font-semibold text-text-primary">{title}</h2>
        <div className="text-sm text-text-secondary">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
