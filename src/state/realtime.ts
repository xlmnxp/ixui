import { operationsStore, applyOperationEvent } from "./operations";
import { instancesStore, applyInstanceLifecycle } from "./instances";
import { instancesApi } from "../api";
import { projectFor } from "../api/client";
import type { EventStream } from "../api/events";
import type { Operation } from "../api/types";

export function initRealtime(stream: EventStream): () => void {
  return stream.onEvent((event) => {
    if (event.type === "operation") {
      const operation = event.metadata as Operation | null;
      if (!operation?.id) return;
      operationsStore.setState((prev) => applyOperationEvent(prev, { id: operation.id, operation }));
      if ((operation.status === "Success" || operation.status === "Failure") && operation.resources?.instances) {
        for (const resource of operation.resources.instances) {
          const instanceName = resource.split("/").pop();
          if (!instanceName) continue;
          void instancesApi
            .get(instanceName, projectFor(instanceName))
            .then((fresh) => {
              instancesStore.setState((prev) => ({ ...prev, [`${fresh.project}/${fresh.name}`]: fresh }));
            })
            .catch(() => {});
        }
      }
    } else if (event.type === "lifecycle") {
      const meta = event.metadata as { action: string; source: string };
      instancesStore.setState((prev) => applyInstanceLifecycle(prev, meta));
    }
  });
}
