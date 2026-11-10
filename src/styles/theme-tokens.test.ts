import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(process.cwd(), "src/styles/theme.css"), "utf8");

function token(block: string, name: string): string | undefined {
  return block.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Sum of absolute channel differences — a proxy for "visibly different". */
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

const dark = css.slice(css.indexOf("@theme {"), css.indexOf(':root[data-theme="light"]'));
const light = css.slice(css.indexOf(':root[data-theme="light"]'));

describe("sidebar hover token", () => {
  it("is clearly distinct from the sidebar in dark mode", () => {
    const hover = token(dark, "hover")!;
    const sidebar = token(dark, "sidebar")!;
    expect(distance(hover, sidebar)).toBeGreaterThan(24);
  });

  it("is clearly distinct from the sidebar in light mode", () => {
    const hover = token(light, "hover")!;
    const sidebar = token(light, "sidebar")!;
    // surface-700 equals the light sidebar, so hover must not resolve to it.
    expect(hover).not.toBe(token(light, "surface-700"));
    expect(distance(hover, sidebar)).toBeGreaterThan(24);
  });
});
