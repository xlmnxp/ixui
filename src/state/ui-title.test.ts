import { uiTitleStore, loadUiTitle, DEFAULT_UI_TITLE } from "./ui-title";

vi.mock("../api", () => ({
  serverApi: { info: vi.fn() },
}));

describe("ui title", () => {
  beforeEach(() => uiTitleStore.setState(DEFAULT_UI_TITLE));

  it("loads user.ui.title from the server config", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ config: { "user.ui.title": "My Cloud" } } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe("My Cloud");
  });

  it("keeps the default when the key is missing or blank", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockResolvedValue({ config: {} } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
    vi.mocked(serverApi.info).mockResolvedValue({ config: { "user.ui.title": "   " } } as never);
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
  });

  it("keeps the default when the fetch fails", async () => {
    const { serverApi } = await import("../api");
    vi.mocked(serverApi.info).mockRejectedValue(new Error("down"));
    await loadUiTitle();
    expect(uiTitleStore.getState()).toBe(DEFAULT_UI_TITLE);
  });
});
