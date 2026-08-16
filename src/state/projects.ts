import { createStore } from "./store";
import { infraApi } from "../api";
import { ALL_PROJECTS } from "../api/client";
import type { Project } from "../api/types";

function readStoredProject(): string {
  try {
    return window.localStorage.getItem("ixui.project.v2") ?? ALL_PROJECTS;
  } catch {
    return ALL_PROJECTS;
  }
}

export const projectsStore = createStore<Project[]>([]);
export const projectsLoadingStore = createStore<boolean>(false);
export const currentProjectStore = createStore<string>(readStoredProject());

export function setCurrentProject(name: string): void {
  currentProjectStore.setState(name);
  try {
    window.localStorage.setItem("ixui.project.v2", name);
  } catch {
    // storage unavailable — non-fatal
  }
}

export async function loadProjects(): Promise<void> {
  projectsLoadingStore.setState(true);
  try {
    const projects = await infraApi.listProjects();
    projectsStore.setState(projects);
  } finally {
    projectsLoadingStore.setState(false);
  }
}
