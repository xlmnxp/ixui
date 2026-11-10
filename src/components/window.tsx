import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useFocusTrap } from "../lib/use-focus-trap";
import { useUnsavedGuard } from "../lib/use-unsaved-guard";
import { ConfirmDialog } from "./confirm-dialog";

export interface WindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel width in px (default 640). */
  width?: number;
  /** Body max height: px number or any CSS length (default 420). */
  bodyMaxHeight?: number | string;
  /** Unsaved edits: backdrop, Escape and the close button ask before discarding. */
  dirty?: boolean;
  /** Copy for the confirmation prompt. */
  discardMessage?: string;
  /** Render the footer with a close handler that honours the unsaved guard. */
  renderFooter?: (close: () => void) => ReactNode;
}

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function Window({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 640,
  bodyMaxHeight = 420,
  dirty = false,
  discardMessage = "You have unsaved changes. Discard them?",
  renderFooter,
}: WindowProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
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

  useEffect(() => {
    if (!open) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const width = panelRef.current?.offsetWidth || 640;
      const height = panelRef.current?.offsetHeight || 520;
      const maxX = Math.max(0, window.innerWidth - width);
      const maxY = Math.max(0, window.innerHeight - height);
      setPos({
        x: Math.min(maxX / 2, Math.max(-maxX / 2, d.origX + e.clientX - d.startX)),
        y: Math.min(maxY / 2, Math.max(-maxY / 2, d.origY + e.clientY - d.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [open]);

  if (!open) return null;

  const footerNode = renderFooter ? renderFooter(guard.requestClose) : footer;

  return createPortal(
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="window-backdrop" onClick={guard.requestClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="window"
        className="overflow-hidden rounded-lg border border-border bg-surface-800 shadow-2xl outline-none"
        style={{ width: `${width}px`, transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          data-testid="window-drag"
          onPointerDown={(e) => {
            dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
          }}
          className="flex cursor-move items-center justify-between border-b border-border bg-surface-700 px-4 py-2.5 select-none"
        >
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
            {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
          </div>
          <button data-testid="window-close" onClick={guard.requestClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div
          className="overflow-auto p-4 text-sm text-text-secondary"
          style={{ maxHeight: typeof bodyMaxHeight === "number" ? `${bodyMaxHeight}px` : bodyMaxHeight }}
        >
          {children}
        </div>
        {footerNode && <div className="flex justify-end gap-2 border-t border-border bg-surface-900 px-4 py-3">{footerNode}</div>}
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
