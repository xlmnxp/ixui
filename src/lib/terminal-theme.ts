import type { ITheme } from "xterm";

export type ThemeMode = "dark" | "light";

// Backgrounds match the --color-surface-950 token for each theme so the terminal
// blends into the surrounding page and the active tab.
const DARK: ITheme = { background: "#191817" };

const LIGHT: ITheme = {
  background: "#f6f5f4",
  foreground: "#1f1e1d",
  cursor: "#1f1e1d",
  cursorAccent: "#f6f5f4",
  selectionBackground: "rgba(221, 72, 20, 0.25)",
  // The default ANSI palette is tuned for dark backgrounds; these stay readable on light.
  black: "#1f1e1d",
  red: "#b42318",
  green: "#1a7f37",
  yellow: "#8a5a00",
  blue: "#0b5cad",
  magenta: "#8250df",
  cyan: "#0e7490",
  white: "#6b675f",
  brightBlack: "#4a4742",
  brightRed: "#cf222e",
  brightGreen: "#2da44e",
  brightYellow: "#9a6700",
  brightBlue: "#0969da",
  brightMagenta: "#a475f9",
  brightCyan: "#1b7c83",
  brightWhite: "#1f1e1d",
};

export function terminalTheme(mode: ThemeMode): ITheme {
  return mode === "light" ? LIGHT : DARK;
}
