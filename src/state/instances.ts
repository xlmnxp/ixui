import { createStore } from "./store";
import { instancesApi } from "../api";
import { ALL_PROJECTS } from "../api/client";
import type { Instance } from "../api/types";

export const instancesStore = createStore<Record<string, Instance>>({});

const ACTION_STATUS: Record<string, Instance["status"]> = {
  "instance-started": "Started",
  "instance-stopped": "Stopped",
  "instance-restarted": "Started",
  "instance-frozen": "Frozen",
  "instance-unfrozen": "Started",
  "instance-paused": "Started",
};

export function applyInstanceLifecycle(
  state: Record<string, Instance>,
  meta: { action: string; source: string }
): Record<string, Instance> {
  if (meta.action === "instance-deleted") {
    const next: Record<string, Instance> = {};
    for (const [key, instance] of Object.entries(state)) {
      if (key.endsWith(`/${instance.name}`) && meta.source.endsWith(`/${instance.name}`)) continue;
      next[key] = instance;
    }
    return next;
  }
  const status = ACTION_STATUS[meta.action];
  if (!status) return state;
  const next: Record<string, Instance> = {};
  for (const [key, instance] of Object.entries(state)) {
    if (meta.source.endsWith(`/${instance.name}`)) next[key] = { ...instance, status };
    else next[key] = instance;
  }
  return next;
}

export async function loadInstances(project: string): Promise<void> {
  const list = await instancesApi.list();
  if (project === ALL_PROJECTS) {
    const next: Record<string, Instance> = {};
    for (const instance of list) next[`${instance.project}/${instance.name}`] = instance;
    instancesStore.setState(next);
    return;
  }
  const scoped = list.filter((i) => i.project === project);
  instancesStore.setState((prev) => {
    const next = { ...prev };
    for (const [key] of Object.entries(next)) {
      if (key.startsWith(`${project}/`)) delete next[key];
    }
    for (const instance of scoped) {
      next[`${project}/${instance.name}`] = instance;
    }
    return next;
  });
}
