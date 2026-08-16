import { api } from "./api";
import { eventStream } from "./api";
import { initRealtime } from "./state/realtime";
import { loadProjects, currentProjectStore } from "./state/projects";
import { loadUiTitle } from "./state/ui-title";
import { markForbidden } from "./auth/status";
import { setProjectProvider } from "./api/client";

export function initApp(): void {
  api.setForbiddenHandler(markForbidden);
  setProjectProvider(() => currentProjectStore.getState());
  initRealtime(eventStream);
  eventStream.connect();
  void loadProjects().catch(() => {});
  void loadUiTitle().catch(() => {});
}
