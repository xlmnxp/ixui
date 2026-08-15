/**
 * incusd does not negotiate WebSocket subprotocols, and browsers abort the
 * handshake when a requested protocol is not selected. spice-html5 requests
 * the "binary" subprotocol internally, so the VGA console installs this shim
 * while it is active: any WebSocket created under it drops its subprotocol
 * arguments. This keeps the vendored spice-html5 library untouched.
 */
export function createSubprotocolShim(): { install: () => void; restore: () => void } {
  let native: typeof WebSocket | null = null;
  return {
    install() {
      if (native !== null) return;
      native = window.WebSocket;
      const shimmed = function (this: unknown, url: string | URL, _protocols?: string | string[]) {
        return new (native as typeof WebSocket)(url);
      } as unknown as typeof WebSocket;
      window.WebSocket = shimmed;
    },
    restore() {
      if (native !== null) {
        window.WebSocket = native;
        native = null;
      }
    },
  };
}
