import { createStore } from "./store";
import { serverApi } from "../api";
import { markForbidden, markProbeAuthenticated } from "../auth/status";

export const DEFAULT_UI_TITLE = "Incus";

export const uiTitleStore = createStore<string>(DEFAULT_UI_TITLE);

/** user.ui.sso_only — when true the UI redirects straight to the OIDC provider. */
export const uiSsoOnlyStore = createStore<boolean>(false);

/**
 * Load the user-configured UI settings (user.ui.*) and run the auth probe.
 * Unauthenticated GET /1.0 still returns 200 with auth: "untrusted" (and only
 * the user.ui.* config), so authentication must be judged from that field —
 * not from the response status.
 */
export async function loadUiTitle(): Promise<void> {
  try {
    const info = await serverApi.info();
    const title = info.config?.["user.ui.title"];
    if (title && title.trim()) uiTitleStore.setState(title.trim());
    uiSsoOnlyStore.setState(info.config?.["user.ui.sso_only"] === "true");

    if (info.auth === "trusted") {
      markProbeAuthenticated();
    } else if (info.auth === "untrusted" || info.auth === "guest") {
      markForbidden();
    }
  } catch {
    // Keep the default title and the unknown auth state when the server is unreachable.
  }
}
