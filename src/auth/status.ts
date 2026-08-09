import { createStore } from "../state/store";

export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";

export const authStore = createStore<AuthStatus>("unknown");

export function markForbidden(): void {
  authStore.setState("unauthenticated");
}

export function markAuthenticated(): void {
  if (authStore.getState() === "authenticated") return;
  authStore.setState("authenticated");
}
