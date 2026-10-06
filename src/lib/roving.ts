import type { KeyboardEvent } from "react";

/** Arrow/Home/End navigation across `[role=tab]` siblings; activates the target via click. */
export function onTablistKeyDown(e: KeyboardEvent<HTMLElement>, orientation: "horizontal" | "vertical"): void {
  const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  if (![prev, next, "Home", "End"].includes(e.key)) return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  if (tabs.length === 0) return;
  const idx = tabs.indexOf(document.activeElement as HTMLElement);
  let target = idx;
  if (e.key === next) target = (idx + 1) % tabs.length;
  else if (e.key === prev) target = (idx - 1 + tabs.length) % tabs.length;
  else if (e.key === "Home") target = 0;
  else target = tabs.length - 1;
  e.preventDefault();
  tabs[target]?.focus();
  tabs[target]?.click();
}
