import { createStore } from "./store";
import { readPersisted, writePersisted } from "../lib/persist";

export type ThemePreference = "system" | "dark" | "light";

const isPreference = (v: unknown): v is ThemePreference => v === "system" || v === "dark" || v === "light";

export const themeStore = createStore<ThemePreference>(readPersisted("theme", "system", isPreference));

const prefersLight = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;

export function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") return prefersLight() ? "light" : "dark";
  return pref;
}

/** The theme actually in effect ("system" resolved against the OS setting). */
export const resolvedThemeStore = createStore<"dark" | "light">("dark");

export function applyTheme(pref: ThemePreference = themeStore.getState()): void {
  const resolved = resolveTheme(pref);
  resolvedThemeStore.setState(resolved);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function setTheme(pref: ThemePreference): void {
  themeStore.setState(pref);
  writePersisted("theme", pref);
  applyTheme(pref);
}

const ORDER: ThemePreference[] = ["system", "dark", "light"];

export function cycleTheme(): void {
  setTheme(ORDER[(ORDER.indexOf(themeStore.getState()) + 1) % ORDER.length]!);
}

/** Apply the saved theme and follow OS changes while the preference is "system". */
export function initTheme(): void {
  applyTheme();
  if (typeof window.matchMedia !== "function") return;
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (themeStore.getState() === "system") applyTheme();
  });
}
