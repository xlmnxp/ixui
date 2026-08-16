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
    expect(map["volatile.cloud-init.instance-id"]).toContain("instance-id");
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

  it("resolves {{token}} cross-references and falls back to long descriptions", () => {
    metadataStore.setState({
      "snapshots.schedule": "{{snapshot_schedule_format}}",
      "snapshots.expiry": "{{snapshot_expiry_format}}",
      "snapshot_schedule_format": "Cron expression or schedule alias",
    });
    const longs = { "snapshots.expiry": "Specify an expression like 1M 2H 3d 4w 5m 6y" };
    expect(configDescription(metadataStore.getState(), "snapshots.schedule", longs)).toBe("Cron expression or schedule alias");
    expect(configDescription(metadataStore.getState(), "snapshots.expiry", longs)).toBe("Specify an expression like 1M 2H 3d 4w 5m 6y");
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
