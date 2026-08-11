import { pageBarStore } from "../state/page-bar";
import { useStore } from "../state/store";

export function PageBar() {
  const bar = useStore(pageBarStore);

  if (!bar) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-900 px-3" data-testid="page-bar">
      <div className="min-w-0 truncate text-sm font-semibold text-text-primary">{bar.title}</div>
      {bar.actions && bar.actions.length > 0 && (
        <div className="ml-auto flex items-center gap-1.5">{bar.actions}</div>
      )}
    </div>
  );
}
