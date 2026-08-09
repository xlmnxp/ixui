import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface WindowProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

interface DragState {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

export function Window({ open, onClose, title, subtitle, children, footer }: WindowProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="window-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="window"
        className="w-[640px] overflow-hidden rounded-lg border border-border bg-surface-800 shadow-2xl"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
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
          <button data-testid="window-close" onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[420px] overflow-auto p-4 text-sm text-text-secondary">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-900 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
