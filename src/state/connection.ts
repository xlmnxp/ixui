import { createStore } from "./store";
import { loadInstances } from "./instances";
import { currentProjectStore } from "./projects";
import type { ConnectionStatus, EventStream } from "../api/events";

export const connectionStore = createStore<ConnectionStatus>("connecting");

/** Mirror the event stream's connection state and resync state after an outage. */
export function initConnection(stream: EventStream): () => void {
  return stream.onStatus((status, isReconnect) => {
    connectionStore.setState(status);
    // Events fired while offline are lost, so refetch what the stream keeps live.
    if (status === "connected" && isReconnect) {
      void loadInstances(currentProjectStore.getState()).catch(() => {});
    }
  });
}
