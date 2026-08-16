import { createStore } from "./store";
import { instancesApi } from "../api";
import { ALL_PROJECTS, registerInstanceProject, removeInstanceProject, resetInstanceProjects } from "../api/client";
import type { Instance } from "../api/types";

export const instancesStore = createStore<Record<string, Instance>>({});

/** True while an explicit instances list fetch is in flight. */
export const instancesLoadingStore = createStore<boolean>(false);

const ACTION_STATUS: Record<string, Instance["status"]> = {
  "instance-started": "Started",
  "instance-stopped": "Stopped",
  "instance-restarted": "Started",
  "instance-frozen": "Frozen",
  "instance-unfrozen": "Started",
  "instance-paused": "Started",
};

/** Extract the instance name from a lifecycle event source like "/1.0/instances/web1?project=dev". */
export function instanceNameFromSource(source: string): string | null {
  try {
    const path = source.split("?")[0] ?? "";
    const last = path.split("/").pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

/** Extract the project from a lifecycle event source query, if present. */
export function projectFromSource(source: string): string | null {
  try {
    const query = source.split("?")[1];
    if (!query) return null;
    const project = new URLSearchParams(query).get("project");
    return project ?? null;
  } catch {
    return null;
  }
}

export function applyInstanceLifecycle(
  state: Record<string, Instance>,
  meta: { action: string; source: string }
): Record<string, Instance> {
  const name = instanceNameFromSource(meta.source);
  if (!name) return state;
  // Scope to the event's project when the source carries one; otherwise fall
  // back to name-only matching (the daemon omits ?project for the default project).
  const project = projectFromSource(meta.source);
  const matches = (instance: Instance): boolean =>
    instance.name === name && (project === null || instance.project === project);
  if (meta.action === "instance-deleted") {
    const next: Record<string, Instance> = {};
    for (const [key, instance] of Object.entries(state)) {
      if (matches(instance)) continue;
      next[key] = instance;
    }
    return next;
  }
  const status = ACTION_STATUS[meta.action];
  if (!status) return state;
  const next: Record<string, Instance> = {};
  for (const [key, instance] of Object.entries(state)) {
    if (matches(instance)) next[key] = { ...instance, status };
    else next[key] = instance;
  }
  return next;
}

export async function loadInstances(project: string): Promise<void> {
  instancesLoadingStore.setState(true);
  try {
    await loadInstancesInternal(project);
  } finally {
    instancesLoadingStore.setState(false);
  }
}

async function loadInstancesInternal(project: string): Promise<void> {
  const list = await instancesApi.list();
  // The returned list is authoritative for the projects it contains: prune their
  // registry entries first so renamed/deleted instances don't linger, then
  // re-register. Projects absent from the list are left untouched.
  if (project === ALL_PROJECTS) {
    resetInstanceProjects();
    for (const instance of list) registerInstanceProject(instance.name, instance.project);
  } else {
    for (const listedProject of new Set(list.map((i) => i.project))) {
      removeInstanceProject(listedProject);
    }
    for (const instance of list) registerInstanceProject(instance.name, instance.project);
  }
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
