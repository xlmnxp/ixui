import "@testing-library/jest-dom/vitest";

if (typeof window.PointerEvent === "undefined") {
  window.PointerEvent = window.MouseEvent as unknown as typeof window.PointerEvent;
}

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}

const webCrypto = globalThis.crypto as Crypto & { random?: (len: number) => string };
if (webCrypto && typeof webCrypto.random !== "function") {
  webCrypto.random = (len: number) => {
    const bytes = new Uint8Array(len);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  };
}
