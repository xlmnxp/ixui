import type { ReactNode } from "react";
import { onTablistKeyDown } from "../lib/roving";

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
    <div onKeyDown={(e) => onTablistKeyDown(e, "horizontal")} role="tablist" data-testid="tabs" className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          tabIndex={active === t.key || (!tabs.some((x) => x.key === active) && t === tabs[0]) ? 0 : -1}
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
