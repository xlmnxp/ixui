import { createStore } from "../state/store";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export const authStore = createStore<AuthStatus>("unknown");

export function markForbidden(): void {
  authStore.setState("unauthenticated");
}

export function markAuthenticated(): void {
  const state = authStore.getState();
  if (state !== "unknown") return;
  authStore.setState("authenticated");
}

/** Explicitly authenticated by the startup probe (GET /1.0 reporting auth: trusted). */
export function markProbeAuthenticated(): void {
  authStore.setState("authenticated");
}
