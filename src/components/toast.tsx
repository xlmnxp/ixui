import { createStore, useStore } from "../state/store";

export interface ToastItem {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  message: string;
}

export const toastStore = createStore<ToastItem[]>([]);

let toastCounter = 0;

export function toast(tone: ToastItem["tone"], message: string): void {
  const id = `toast-${++toastCounter}`;
  toastStore.setState((prev) => [...prev, { id, tone, message }]);
  window.setTimeout(() => dismissToast(id), 4000);
}

export function dismissToast(id: string): void {
  toastStore.setState((prev) => prev.filter((t) => t.id !== id));
}

const toneClasses: Record<ToastItem["tone"], string> = {
  info: "border-blue-500/40",
  success: "border-green-500/40",
  warning: "border-amber-500/40",
  danger: "border-danger/40",
};

export function Toaster() {
  const toasts = useStore(toastStore);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" data-testid="toaster">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          className={`pointer-events-auto flex items-center gap-3 rounded border bg-surface-800 px-3 py-2 text-sm text-text-primary shadow-lg ${toneClasses[t.tone]}`}
        >
          <span>{t.message}</span>
          <button
            data-testid={`toast-close-${t.id}`}
            onClick={() => dismissToast(t.id)}
            className="text-text-tertiary hover:text-text-primary"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
