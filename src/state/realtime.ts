import { operationsStore, applyOperationEvent } from "./operations";
import { instancesStore, applyInstanceLifecycle } from "./instances";
import type { EventStream } from "../api/events";

export function initRealtime(stream: EventStream): () => void {
  return stream.onEvent((event) => {
    if (event.type === "operation") {
      const meta = event.metadata as { id: string; operation: import("../api/types").Operation };
      if (meta?.operation) {
        operationsStore.setState((prev) => applyOperationEvent(prev, meta));
      }
    } else if (event.type === "lifecycle") {
      const meta = event.metadata as { action: string; source: string };
      instancesStore.setState((prev) => applyInstanceLifecycle(prev, meta));
    }
  });
}
