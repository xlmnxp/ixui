import "@testing-library/jest-dom/vitest";

if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = window.MouseEvent as unknown as typeof window.PointerEvent;
}

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
