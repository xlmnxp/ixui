import { api } from "./api";
import { eventStream } from "./api";
import { initRealtime } from "./state/realtime";
import { loadProjects } from "./state/projects";
import { markForbidden } from "./auth/status";

export function initApp(): void {
  api.setForbiddenHandler(markForbidden);
  initRealtime(eventStream);
  eventStream.connect();
  void loadProjects().catch(() => {});
}
