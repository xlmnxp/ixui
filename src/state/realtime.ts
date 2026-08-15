import { operationsStore, applyOperationEvent } from "./operations";
import { instancesStore, applyInstanceLifecycle, instanceNameFromSource, projectFromSource } from "./instances";
import { recordActivity } from "./activity";
import { instancesApi } from "../api";
import { registerInstanceProject, unregisterInstanceProject } from "../api/client";
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
          const instanceName = instanceNameFromSource(resource);
          if (!instanceName) continue;
          // A name may exist in several projects in all-projects mode — refresh
          // every entry that matches, using each entry's known project.
          const candidates = Object.values(instancesStore.getState()).filter((i) => i.name === instanceName);
          for (const instance of candidates) {
            void instancesApi
              .get(instance.name, instance.project)
              .then((fresh) => {
                instancesStore.setState((prev) => ({ ...prev, [`${fresh.project}/${fresh.name}`]: fresh }));
              })
              .catch(() => {
                instancesStore.setState((prev) => {
                  const next = { ...prev };
                  for (const [key, entry] of Object.entries(next)) {
                    if (entry.name === instance.name && entry.project === instance.project) delete next[key];
                  }
                  return next;
                });
              });
          }
        }
      }
    } else if (event.type === "lifecycle") {
      const meta = event.metadata as { action: string; source: string; requestor?: { username?: string; address?: string } | null };
      const name = instanceNameFromSource(meta.source);
      const project = projectFromSource(meta.source);
      if (name) {
        if (meta.action === "instance-deleted") unregisterInstanceProject(name, project ?? undefined);
        else if (project) registerInstanceProject(name, project);
      }
      recordActivity(meta, event.timestamp);
      instancesStore.setState((prev) => applyInstanceLifecycle(prev, meta));
    }
  });
}
