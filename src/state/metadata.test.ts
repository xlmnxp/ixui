import { metadataStore, loadMetadata, configDescription } from "./metadata";

vi.mock("../api", () => ({
  serverApi: {
    metadata: vi.fn().mockResolvedValue({
      configs: { instance: { instance: { keys: [{ "limits.memory": { shortdesc: "Memory limit" } }] } } },
    }),
  },
}));

describe("metadata store", () => {
  beforeEach(() => metadataStore.setState({}));

  it("loads server metadata and merges the image.* fallbacks", async () => {
    await loadMetadata();
    const map = metadataStore.getState();
    expect(map["limits.memory"]).toBe("Memory limit");
    expect(map["image.architecture"]).toBe("CPU architecture of the image");
    expect(map["image.os"]).toBe("Operating system name");
  });

  it("resolves wildcard fallbacks like image.requirements.*", () => {
    metadataStore.setState({ "image.requirements.*": "Image requirement flag" });
    expect(configDescription(metadataStore.getState(), "image.requirements.cgroup")).toBe("Image requirement flag");
    expect(configDescription(metadataStore.getState(), "image.requirements.nesting")).toBe("Image requirement flag");
  });

  it("prefers exact keys over wildcards", () => {
    metadataStore.setState({ "limits.memory": "Memory limit", "limits.*": "Some limit" });
    expect(configDescription(metadataStore.getState(), "limits.memory")).toBe("Memory limit");
  });

  it("matches placeholder patterns like volatile.<name>.hwaddr", () => {
    metadataStore.setState({
      "volatile.<name>.hwaddr": "Network device MAC address",
      "volatile.<name>.last_state.hwaddr": "Network device original MAC",
    });
    expect(configDescription(metadataStore.getState(), "volatile.eth0.hwaddr")).toBe("Network device MAC address");
    expect(configDescription(metadataStore.getState(), "volatile.eth1.last_state.hwaddr")).toBe("Network device original MAC");
    // A non-matching segment count returns undefined.
    expect(configDescription(metadataStore.getState(), "volatile.eth0")).toBeUndefined();
  });
});
