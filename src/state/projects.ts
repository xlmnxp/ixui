import { createStore } from "./store";
import { infraApi } from "../api";
import type { Project } from "../api/types";

function readStoredProject(): string {
  try {
    return window.localStorage.getItem("ixui.project") ?? "default";
  } catch {
    return "default";
  }
}

export const projectsStore = createStore<Project[]>([]);
export const currentProjectStore = createStore<string>(readStoredProject());

export function setCurrentProject(name: string): void {
  currentProjectStore.setState(name);
  try {
    window.localStorage.setItem("ixui.project", name);
  } catch {
    // storage unavailable — non-fatal
  }
}

export async function loadProjects(): Promise<void> {
  const projects = await infraApi.listProjects();
  projectsStore.setState(projects);
}
