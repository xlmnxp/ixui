import {
  loadCatalog,
  loadRemotes,
  normalizeFingerprint,
  PREFILL_IMAGES,
  saveRemotes,
  SIMPLESTREAMS_PREFILL_ALIAS,
} from "./image-prefill";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("image-prefill", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("PREFILL_IMAGES", () => {
    it("covers the curated distros", () => {
      const oses = [...new Set(PREFILL_IMAGES.map((e) => e.os))];
      expect(oses).toEqual(
        expect.arrayContaining([
          "ubuntu", "debian", "alpine", "rockylinux", "almalinux",
          "fedora", "centos", "archlinux", "opensuse", "kali", "nixos",
        ])
      );
    });

    it("includes default and cloud variants for each release", () => {
      for (const os of ["ubuntu", "debian", "alpine"]) {
        const releases = new Set(PREFILL_IMAGES.filter((e) => e.os === os).map((e) => e.release));
        for (const release of releases) {
          const variants = PREFILL_IMAGES.filter((e) => e.os === os && e.release === release).map((e) => e.variant);
          expect(variants).toEqual(expect.arrayContaining(["default", "cloud"]));
        }
      }
    });

    it("always lists amd64", () => {
      for (const entry of PREFILL_IMAGES) {
        expect(entry.archs).toContain("amd64");
      }
    });
  });

  describe("SIMPLESTREAMS_PREFILL_ALIAS", () => {
    it("builds the simplestreams alias", () => {
      const ubuntuCloud = PREFILL_IMAGES.find((e) => e.os === "ubuntu" && e.release === "24.04" && e.variant === "cloud");
      expect(SIMPLESTREAMS_PREFILL_ALIAS(ubuntuCloud!, "amd64")).toBe("ubuntu/24.04/cloud/amd64");
      const rockyDefault = PREFILL_IMAGES.find((e) => e.os === "rockylinux" && e.release === "9" && e.variant === "default");
      expect(SIMPLESTREAMS_PREFILL_ALIAS(rockyDefault!, "arm64")).toBe("rockylinux/9/default/arm64");
    });
  });

  describe("normalizeFingerprint", () => {
    it("strips the sha256 prefix and lowercases", () => {
      expect(normalizeFingerprint("sha256:AbCd")).toBe("abcd");
      expect(normalizeFingerprint("ABCD")).toBe("abcd");
    });
  });

  describe("remotes", () => {
    beforeEach(() => localStorage.clear());

    it("defaults to the simplestreams server", () => {
      expect(loadRemotes()).toEqual([SIMPLE_STREAMS_DEFAULT]);
    });

    it("round-trips saved remotes", () => {
      saveRemotes(["https://images.example.com", "https://images.other.org"]);
      expect(loadRemotes()).toEqual(["https://images.example.com", "https://images.other.org"]);
    });

    it("filters invalid entries on load", () => {
      localStorage.setItem("ixui.custom-remotes", JSON.stringify(["not-a-url", 42, "https://ok.example.com"]));
      expect(loadRemotes()).toEqual(["https://ok.example.com"]);
    });
  });

  describe("loadCatalog", () => {
    beforeEach(() => localStorage.clear());

    it("fetches the catalog and caches it", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(jsonResponse(200, { index: { images: { path: "streams/v1/images.json" } } }))
        .mockResolvedValueOnce(jsonResponse(200, {
          products: {
            "ubuntu-24.04-cloud-amd64": {
              os: "ubuntu", release: "24.04", version: "v1", arch: "amd64",
              variants: { cloud: { items: { squashfs: { size: 100, fingerprint: "fp1" } } } },
            },
          },
        }));
      vi.stubGlobal("fetch", fetchMock);
      const catalog = await loadCatalog("https://images.a.example.com");
      expect(catalog?.products["ubuntu-24.04-cloud-amd64"]?.size).toBe(100);
      const cached = await loadCatalog("https://images.a.example.com");
      expect(cached).toBe(catalog);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("serves the localStorage cache when offline", async () => {
      const catalog = {
        products: {
          "debian-13-cloud-amd64": {
            os: "debian", release: "13", version: "v1", variant: "cloud", arch: "amd64",
            itemTypes: ["squashfs"], size: 100, path: "p", fingerprints: ["fp1"],
          },
        },
      };
      localStorage.setItem("ixui.catalog.v2.https://images.b.example.com", JSON.stringify({ catalog }));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      const result = await loadCatalog("https://images.b.example.com");
      expect(result?.products["debian-13-cloud-amd64"]?.fingerprints).toEqual(["fp1"]);
    });

    it("returns null when the fetch fails and nothing is cached", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      await expect(loadCatalog("https://images.c.example.com")).resolves.toBeNull();
    });
  });
});
