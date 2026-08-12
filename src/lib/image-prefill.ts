import { fetchCatalog, SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";
import type { SimplestreamsCatalog } from "../api/simplestreams";

export interface PrefillImage {
  os: string;
  release: string;
  variant: string;
  archs: string[];
}

export const PREFILL_IMAGES: PrefillImage[] = [
  { os: "ubuntu", release: "24.04", variant: "default", archs: ["amd64", "arm64"] },
  { os: "ubuntu", release: "24.04", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "ubuntu", release: "22.04", variant: "default", archs: ["amd64", "arm64"] },
  { os: "ubuntu", release: "22.04", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "debian", release: "13", variant: "default", archs: ["amd64", "arm64"] },
  { os: "debian", release: "13", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "debian", release: "12", variant: "default", archs: ["amd64", "arm64"] },
  { os: "debian", release: "12", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "alpine", release: "3.22", variant: "default", archs: ["amd64", "arm64"] },
  { os: "alpine", release: "3.22", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "alpine", release: "3.21", variant: "default", archs: ["amd64", "arm64"] },
  { os: "alpine", release: "3.21", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "rockylinux", release: "9", variant: "default", archs: ["amd64", "arm64"] },
  { os: "rockylinux", release: "9", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "rockylinux", release: "10", variant: "default", archs: ["amd64", "arm64"] },
  { os: "rockylinux", release: "10", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "almalinux", release: "9", variant: "default", archs: ["amd64", "arm64"] },
  { os: "almalinux", release: "9", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "almalinux", release: "10", variant: "default", archs: ["amd64", "arm64"] },
  { os: "almalinux", release: "10", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "fedora", release: "42", variant: "default", archs: ["amd64", "arm64"] },
  { os: "fedora", release: "42", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "centos", release: "9-stream", variant: "default", archs: ["amd64", "arm64"] },
  { os: "centos", release: "9-stream", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "archlinux", release: "current", variant: "default", archs: ["amd64", "arm64"] },
  { os: "archlinux", release: "current", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "opensuse", release: "15.6", variant: "default", archs: ["amd64", "arm64"] },
  { os: "opensuse", release: "15.6", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "kali", release: "current", variant: "default", archs: ["amd64", "arm64"] },
  { os: "kali", release: "current", variant: "cloud", archs: ["amd64", "arm64"] },
  { os: "nixos", release: "25.05", variant: "default", archs: ["amd64", "arm64"] },
  { os: "nixos", release: "25.05", variant: "cloud", archs: ["amd64", "arm64"] },
];

export function SIMPLESTREAMS_PREFILL_ALIAS(entry: PrefillImage, arch: string): string {
  return `${entry.os}/${entry.release}/${entry.variant}/${arch}`;
}

const REMOTES_KEY = "ixui.custom-remotes";

export function loadRemotes(): string[] {
  try {
    const raw = localStorage.getItem(REMOTES_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const urls = parsed.filter((x): x is string => typeof x === "string" && /^https?:\/\//.test(x));
        if (urls.length > 0) return urls;
      }
    }
  } catch {
    // ignore storage failures
  }
  return [SIMPLE_STREAMS_DEFAULT];
}

export function saveRemotes(urls: string[]): void {
  try {
    localStorage.setItem(REMOTES_KEY, JSON.stringify(urls));
  } catch {
    // ignore storage failures
  }
}

interface CatalogCacheEntry {
  catalog: SimplestreamsCatalog;
}

const memoryCache = new Map<string, CatalogCacheEntry>();

function cacheKey(server: string): string {
  return `ixui.catalog.${server}`;
}

function readCache(server: string): CatalogCacheEntry | null {
  try {
    const raw = localStorage.getItem(cacheKey(server));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CatalogCacheEntry | null;
    if (parsed && parsed.catalog && typeof parsed.catalog.products === "object" && parsed.catalog.products !== null) {
      return parsed;
    }
  } catch {
    // ignore storage failures
  }
  return null;
}

function writeCache(server: string, entry: CatalogCacheEntry): void {
  try {
    localStorage.setItem(cacheKey(server), JSON.stringify(entry));
  } catch {
    // ignore storage failures
  }
}

async function refreshCatalog(server: string): Promise<SimplestreamsCatalog> {
  const catalog = await fetchCatalog(server);
  const entry: CatalogCacheEntry = { catalog };
  memoryCache.set(server, entry);
  writeCache(server, entry);
  return catalog;
}

export async function loadCatalog(server: string): Promise<SimplestreamsCatalog | null> {
  const memory = memoryCache.get(server);
  if (memory) return memory.catalog;
  const cached = readCache(server);
  if (cached) {
    void refreshCatalog(server).catch(() => {});
    return cached.catalog;
  }
  try {
    return await refreshCatalog(server);
  } catch {
    return null;
  }
}

export function normalizeFingerprint(fingerprint: string): string {
  return fingerprint.replace(/^sha256:/, "").toLowerCase();
}
