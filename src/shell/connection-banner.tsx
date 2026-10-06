import { useEffect, useState } from "react";
import { connectionStore } from "../state/connection";
import { useStore } from "../state/store";

const SHOW_AFTER_MS = 3_000;

/** Warns that live updates are paused; waits a few seconds so brief reconnects stay silent. */
export function ConnectionBanner() {
  const status = useStore(connectionStore);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== "disconnected") {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  if (!visible) return null;
  return (
    <div
      role="status"
      data-testid="connection-banner"
      className="border-b border-amber-500/30 bg-amber-500/15 px-3 py-1 text-center text-xs text-amber-300"
    >
      Connection to the server lost — live updates are paused. Reconnecting…
    </div>
  );
}
