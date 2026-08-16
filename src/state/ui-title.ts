import { createStore } from "./store";
import { serverApi } from "../api";

export const DEFAULT_UI_TITLE = "Incus";

export const uiTitleStore = createStore<string>(DEFAULT_UI_TITLE);

/** Load the user-configured UI title (user.ui.title) from the server config. */
export async function loadUiTitle(): Promise<void> {
  try {
    const info = await serverApi.info();
    const title = info.config?.["user.ui.title"];
    if (title && title.trim()) uiTitleStore.setState(title.trim());
  } catch {
    // Keep the default title when the server is unreachable.
  }
}
