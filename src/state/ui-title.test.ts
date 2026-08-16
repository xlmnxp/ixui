import { uiTitleStore, uiSsoOnlyStore, loadUiTitle, DEFAULT_UI_TITLE } from "./ui-title";
import { authStore } from "../auth/status";

vi.mock("../api", () => ({
  serverApi: { info: vi.fn() },
}));

describe("ui title", () => {
  beforeEach(() => {
    uiTitleStore.setState(DEFAULT_UI_TITLE);
    uiSsoOnlyStore.setState(false);
    authStore.setState("unknown");
  });

  it("loads user.ui.title and marks the auth state trusted", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "trusted", config: { "user.ui.title": "My Cloud" } } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe("My Cloud");
    expect(authStore.getState()).toBe("authenticated");
  });

  it("marks unauthenticated for untrusted/guest responses", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "untrusted", config: {} } as never);
    await loadUiTitle();
    expect(authStore.getState()).toBe("unauthenticated");
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "guest", config: {} } as never);
    authStore.setState("unknown");
    await loadUiTitle();
    expect(authStore.getState()).toBe("unauthenticated");
  });

  it("tracks user.ui.sso_only", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "trusted", config: { "user.ui.sso_only": "true" } } as never);
    await loadUiTitle();
    expect(uiSsoOnlyStore.getState()).toBe(true);
  });

  it("keeps the default when the key is missing or blank", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "trusted", config: {} } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
    vi.mocked(serverApi.info).mockResolvedValue({ auth: "trusted", config: { "user.ui.title": "   " } } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
  });

  it("keeps the unknown state when the fetch fails", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockRejectedValue(new Error("down"));
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
    expect(authStore.getState()).toBe("unknown");
  });
});
