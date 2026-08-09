import type { ReactNode } from "react";

export interface VerticalTabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface VerticalTabsProps {
  tabs: VerticalTabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function VerticalTabs({ tabs, active, onChange }: VerticalTabsProps) {
  return (
    <div role="tablist" aria-orientation="vertical" data-testid="vertical-tabs" className="flex w-44 shrink-0 flex-col border-r border-border bg-surface-900">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          data-testid={`vtab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={`flex items-center gap-2 rounded border-l-2 px-2.5 py-1.5 text-left text-[13px] ${active === t.key ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-transparent text-text-secondary hover:bg-surface-700 hover:text-text-primary"}`}
        >
          {t.icon}
          <span className="truncate">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
