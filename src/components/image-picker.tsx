import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Download, RefreshCw, Search, Trash2, X } from "lucide-react";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";
import type { SimplestreamsCatalog } from "../api/simplestreams";
import type { Image } from "../api/types";
import { infraApi } from "../api";
import {
  loadCatalog,
  loadRemotes,
  normalizeFingerprint,
  PREFILL_IMAGES,
  saveRemotes,
  SIMPLESTREAMS_PREFILL_ALIAS,
} from "../lib/image-prefill";
import { formatBytes } from "../lib/format";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";
import { Select } from "./select";
import { toast } from "./toast";

export interface PickedImage {
  server: string;
  alias: string;
  protocol: "simplestreams" | "oci";
  fingerprint?: string;
}

export interface ImagePickerProps {
  type: "container" | "virtual-machine";
  cloudInitEnabled: boolean;
  onSelect: (image: PickedImage | null) => void;
}

interface PickerRow {
  key: string;
  os: string;
  release: string;
  variant: string;
  arch: string;
  size?: number;
  version?: string;
  fingerprints: string[];
  types: ("container" | "virtual-machine")[];
}

const VM_ITEM_KEYS = ["qcow2", "disk-kvm.img", "disk-uefi.img", "rootfs.disk"];
const CONTAINER_ITEM_KEYS = ["squashfs", "root.tar.xz", "tar.xz", "rootfs.tar.xz"];

function productTypes(itemTypes: string[]): ("container" | "virtual-machine")[] {
  const types: ("container" | "virtual-machine")[] = [];
  if (itemTypes.some((k) => CONTAINER_ITEM_KEYS.includes(k))) types.push("container");
  if (itemTypes.some((k) => VM_ITEM_KEYS.includes(k))) types.push("virtual-machine");
  return types.length > 0 ? types : ["container", "virtual-machine"];
}

function rowsFromCatalog(catalog: SimplestreamsCatalog, type: "container" | "virtual-machine"): PickerRow[] {
  const byKey = new Map<string, PickerRow>();
  for (const product of Object.values(catalog.products)) {
    if (!productTypes(product.itemTypes).includes(type)) continue;
    const key = [product.os, product.release, product.variant, product.arch].map((s) => s.toLowerCase()).filter(Boolean).join("/");
    const existing = byKey.get(key);
    if (existing && (existing.fingerprints.length >= (product.fingerprints?.length ?? 0) || (existing.size ?? 0) >= (product.size ?? 0))) {
      continue;
    }
    byKey.set(key, {
      key,
      os: product.os,
      release: product.release,
      variant: product.variant,
      arch: product.arch,
      size: product.size || undefined,
      version: product.version || undefined,
      fingerprints: product.fingerprints ?? [],
      types: productTypes(product.itemTypes),
    });
  }
  return [...byKey.values()];
}

function rowsFromPrefill(): PickerRow[] {
  const rows: PickerRow[] = [];
  for (const entry of PREFILL_IMAGES) {
    for (const arch of entry.archs) {
      rows.push({
        key: SIMPLESTREAMS_PREFILL_ALIAS(entry, arch),
        os: entry.os,
        release: entry.release,
        variant: entry.variant,
        arch,
        fingerprints: [],
        types: ["container", "virtual-machine"],
      });
    }
  }
  return rows;
}

function sortRows(rows: PickerRow[]): PickerRow[] {
  return [...rows].sort((a, b) => {
    if (a.os !== b.os) return a.os.localeCompare(b.os);
    if (a.release !== b.release) return b.release.localeCompare(a.release, undefined, { numeric: true });
    if (a.variant !== b.variant) return a.variant === "default" ? -1 : b.variant === "default" ? 1 : a.variant.localeCompare(b.variant);
    return a.arch.localeCompare(b.arch);
  });
}

const DISPLAY_NAMES: Record<string, string> = {
  ubuntu: "Ubuntu",
  debian: "Debian",
  alpine: "Alpine",
  rockylinux: "Rocky Linux",
  almalinux: "AlmaLinux",
  fedora: "Fedora",
  centos: "CentOS",
  archlinux: "Arch Linux",
  opensuse: "openSUSE",
  kali: "Kali Linux",
  nixos: "NixOS",
};

export function ImagePicker({ type, cloudInitEnabled, onSelect }: ImagePickerProps) {
  const [tab, setTab] = useState<"distro" | "oci">("distro");
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<SimplestreamsCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [remote, setRemote] = useState(SIMPLE_STREAMS_DEFAULT);
  const [remotes, setRemotes] = useState<string[]>([SIMPLE_STREAMS_DEFAULT]);
  const [manageOpen, setManageOpen] = useState(false);
  const [newRemote, setNewRemote] = useState("");
  const [selected, setSelected] = useState<PickedImage | null>(null);
  const [localImages, setLocalImages] = useState<Image[]>([]);
  const [ociImage, setOciImage] = useState("");
  const [pullOpen, setPullOpen] = useState(false);
  const [pullAlias, setPullAlias] = useState("");
  const [pullServer, setPullServer] = useState(SIMPLE_STREAMS_DEFAULT);
  const [busy, setBusy] = useState(false);

  const loadLocalImages = useCallback(() => {
    void infraApi
      .listImages()
      .then(setLocalImages)
      .catch(() => {});
  }, []);

  const loadCatalogFor = useCallback(async (server: string) => {
    setCatalogLoading(true);
    const loaded = await loadCatalog(server);
    setCatalog(loaded);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    const stored = loadRemotes();
    setRemotes(stored);
    setRemote(stored[0] ?? SIMPLE_STREAMS_DEFAULT);
    void loadCatalogFor(stored[0] ?? SIMPLE_STREAMS_DEFAULT);
    loadLocalImages();
  }, [loadCatalogFor, loadLocalImages]);

  useEffect(() => {
    setSelected(null);
  }, [type, remote]);

  const rows = useMemo(() => {
    const source = catalog ? rowsFromCatalog(catalog, type) : rowsFromPrefill();
    return sortRows(source);
  }, [catalog, type]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => `${r.os} ${r.release} ${r.variant} ${r.arch}`.toLowerCase().includes(q))
      : rows;
    const groups = new Map<string, PickerRow[]>();
    for (const row of filtered) {
      const list = groups.get(row.os) ?? [];
      list.push(row);
      groups.set(row.os, list);
    }
    return [...groups.entries()];
  }, [rows, search]);

  const localFingerprints = useMemo(
    () => new Set(localImages.map((img) => normalizeFingerprint(img.fingerprint))),
    [localImages]
  );

  const selectRow = (row: PickerRow) => {
    const local = localImages.find((img) => row.fingerprints.includes(normalizeFingerprint(img.fingerprint)));
    const picked: PickedImage = {
      server: remote,
      alias: row.key,
      protocol: "simplestreams",
      ...(local ? { fingerprint: local.fingerprint } : {}),
    };
    setSelected(picked);
    onSelect(picked);
  };

  const handleRowClick = (row: PickerRow) => {
    if (cloudInitEnabled && row.variant === "default") {
      const cloudRow = rows.find(
        (r) => r.os === row.os && r.release === row.release && r.variant === "cloud" && r.arch === row.arch
      );
      if (cloudRow) {
        toast("warning", `Cloud-init is enabled — using the ${row.os} cloud variant instead`);
        selectRow(cloudRow);
        return;
      }
      toast("warning", "Cloud-init is enabled but this image has no cloud variant");
    }
    selectRow(row);
  };

  const changeRemote = (server: string) => {
    setRemote(server);
    setSelected(null);
    onSelect(null);
    void loadCatalogFor(server);
  };

  const useOciImage = () => {
    const alias = ociImage.trim();
    if (!alias) return;
    const picked: PickedImage = { server: "docker.io", alias, protocol: "oci" };
    setSelected(picked);
    onSelect(picked);
  };

  const pull = async () => {
    setBusy(true);
    try {
      await infraApi.pullImage({ alias: pullAlias.trim(), server: pullServer.trim() });
      toast("success", `Pulling ${pullAlias.trim()}`);
      setPullOpen(false);
      setPullAlias("");
      const imgs = await infraApi.listImages();
      setLocalImages(imgs);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const addRemote = () => {
    const url = newRemote.trim();
    if (!/^https?:\/\/.+/.test(url)) {
      toast("danger", "Remote must be a valid http(s) URL");
      return;
    }
    if (remotes.includes(url)) {
      toast("info", "Remote already in the list");
      return;
    }
    const updated = [...remotes, url];
    setRemotes(updated);
    saveRemotes(updated);
    setNewRemote("");
  };

  const removeRemote = (index: number) => {
    if (remotes.length <= 1) {
      toast("warning", "At least one remote is required");
      return;
    }
    const removed = remotes[index]!;
    const updated = remotes.filter((_, i) => i !== index);
    setRemotes(updated);
    saveRemotes(updated);
    if (remote === removed) {
      setRemote(updated[0]!);
      setSelected(null);
      onSelect(null);
      void loadCatalogFor(updated[0]!);
    }
  };

  const tabButton = (key: "distro" | "oci", label: string) => (
    <button
      key={key}
      type="button"
      data-testid={`picker-${key}`}
      onClick={() => setTab(key)}
      className={`border-b-2 px-3 py-2 text-sm ${tab === key ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Select label="Remote" name="picker-remote" data-testid="picker-remote" value={remote} onChange={(e) => changeRemote(e.target.value)}>
            {remotes.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="ghost" data-testid="picker-remote-manage" onClick={() => setManageOpen(true)}>Manage</Button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabButton("distro", "Distro")}
        {tabButton("oci", "OCI")}
      </div>

      {tab === "distro" ? (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-text-tertiary" />
            <input
              data-testid="picker-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search images…"
              className="h-8 w-full rounded border border-border bg-surface-500 pl-8 pr-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none"
            />
          </div>
          {catalog === null && !catalogLoading && (
            <p className="text-[11px] text-text-tertiary">Offline — showing bundled image list.</p>
          )}
          <div className="max-h-56 space-y-1 overflow-auto" data-testid="picker-list">
            {grouped.length === 0 && <p className="py-4 text-center text-xs text-text-tertiary">No matching images.</p>}
            {grouped.map(([os, osRows]) => (
              <div key={os}>
                <p className="sticky top-0 bg-surface-800 px-1 py-0.5 text-xs font-semibold text-text-secondary">
                  {DISPLAY_NAMES[os] ?? os}
                </p>
                {osRows.map((row) => {
                  const isSelected = selected?.protocol === "simplestreams" && selected.alias === row.key && selected.server === remote;
                  const cached = row.fingerprints.some((fp) => localFingerprints.has(normalizeFingerprint(fp)));
                  return (
                    <button
                      key={row.key}
                      type="button"
                      data-testid={`picker-row-${row.key}`}
                      onClick={() => handleRowClick(row)}
                      className={`flex w-full items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-left text-[13px] ${isSelected ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-700"}`}
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-text-primary">{row.release}</span>
                        <span className="mx-1 text-text-tertiary">·</span>
                        {row.variant}
                        <span className="mx-1 text-text-tertiary">·</span>
                        {row.arch}
                        {(row.size !== undefined || row.version !== undefined) && (
                          <span className="ml-2 text-[11px] text-text-tertiary">
                            {row.size !== undefined ? formatBytes(row.size) : ""}
                            {row.size !== undefined && row.version ? " · " : ""}
                            {row.version ?? ""}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {cached && (
                          <span data-testid={`picker-cached-${row.key}`} className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-green-400">
                            cached
                          </span>
                        )}
                        <Check size={13} className={isSelected ? "text-accent-400" : "invisible"} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Input
            label="Image"
            name="oci-image"
            data-testid="oci-image"
            value={ociImage}
            onChange={(e) => setOciImage(e.target.value)}
            placeholder="nginx:latest"
          />
          <Button size="sm" data-testid="oci-use" onClick={useOciImage} disabled={!ociImage.trim()}>
            <Download size={13} /> Use image
          </Button>
          {selected?.protocol === "oci" && (
            <p className="text-xs text-text-tertiary">Selected: {selected.alias} from docker.io</p>
          )}
        </div>
      )}

      <Button size="sm" variant="ghost" onClick={() => setPullOpen((o) => !o)} data-testid="wizard-pull-toggle">
        <RefreshCw size={13} /> Pull from remote
      </Button>
      {pullOpen && (
        <div className="space-y-2 rounded border border-border bg-surface-900 p-3">
          <Input label="Alias" name="pull-alias" data-testid="wizard-pull-alias" value={pullAlias} onChange={(e) => setPullAlias(e.target.value)} placeholder="ubuntu/24.04" />
          <Input label="Server" name="pull-server" data-testid="wizard-pull-server" value={pullServer} onChange={(e) => setPullServer(e.target.value)} />
          <Button size="sm" onClick={pull} loading={busy} data-testid="wizard-pull-submit"><Download size={13} /> Pull</Button>
        </div>
      )}

      <Dialog open={manageOpen} onClose={() => setManageOpen(false)} title="Custom remotes" footer={
        <>
          <Button variant="secondary" onClick={() => setManageOpen(false)}><X size={14} /> Close</Button>
        </>
      }>
        <div className="space-y-2">
          <ul className="max-h-40 space-y-1 overflow-auto">
            {remotes.map((r, idx) => (
              <li key={r} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                <span className="truncate font-mono text-xs text-text-primary">{r}</span>
                <Button size="sm" variant="ghost" data-testid={`picker-remote-remove-${idx}`} onClick={() => removeRemote(idx)}>
                  <Trash2 size={13} /> Remove
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input label="New remote" name="picker-remote-add" data-testid="picker-remote-add" value={newRemote} onChange={(e) => setNewRemote(e.target.value)} placeholder="https://images.example.com" />
            </div>
            <Button size="sm" data-testid="picker-remote-save" onClick={addRemote}>Add</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
