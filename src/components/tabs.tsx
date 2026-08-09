import type { ReactNode } from "react";

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div role="tablist" data-testid="tabs" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          data-testid={`tab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={`border-b-2 px-3 py-2 text-sm ${active === t.key ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
