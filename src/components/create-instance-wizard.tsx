import { useEffect, useMemo, useState } from "react";
import { Box, Monitor, Search, RefreshCw } from "lucide-react";
import { Window } from "./window";
import { Button } from "./button";
import { Input } from "./input";
import { Select } from "./select";
import { Checkbox } from "./checkbox";
import { instancesApi, operationsApi, infraApi } from "../api";
import { loadInstances } from "../state/instances";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import { toast } from "./toast";
import type { Image, Profile, Network } from "../api/types";

export interface CreateInstanceWizardProps {
  open: boolean;
  onClose: () => void;
}

const LIMIT_KEYS: Record<"memory" | "cpu", string> = { memory: "limits.memory", cpu: "limits.cpu" };

export function CreateInstanceWizard({ open, onClose }: CreateInstanceWizardProps) {
  const project = useStore(currentProjectStore);
  const [stage, setStage] = useState(1);
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageFingerprint, setImageFingerprint] = useState("");
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<string[]>(["default"]);
  const [memory, setMemory] = useState("");
  const [cpu, setCpu] = useState("");
  const [network, setNetwork] = useState("");
  const [images, setImages] = useState<Image[]>([]);
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [networkList, setNetworkList] = useState<Network[]>([]);
  const [pullOpen, setPullOpen] = useState(false);
  const [pullAlias, setPullAlias] = useState("");
  const [pullServer, setPullServer] = useState("https://images.linuxcontainers.org");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void Promise.all([infraApi.listImages(), infraApi.listProfiles(), infraApi.listNetworks()])
      .then(([imgs, profs, nets]) => {
        setImages(imgs);
        setProfileList(profs);
        setNetworkList(nets);
      })
      .catch(() => {});
  }, [open]);

  const nameValid = /^[a-zA-Z0-9-]+$/.test(name.trim());
  const filteredImages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return images.filter((i) => i.type === type && (q === "" || (i.description + i.filename + (i.properties?.description ?? "")).toLowerCase().includes(q)));
  }, [images, type, search]);

  const stage2Complete = imageFingerprint !== "";
  const stage4Complete = nameValid && imageFingerprint !== "";

  const next = () => {
    if (stage === 1 && !nameValid) return;
    if (stage === 2 && !stage2Complete) return;
    setStage((s) => Math.min(4, s + 1));
  };
  const back = () => setStage((s) => Math.max(1, s - 1));

  const pull = async () => {
    setBusy(true);
    try {
      await infraApi.pullImage({ alias: pullAlias.trim(), server: pullServer.trim() });
      toast("success", `Pulling ${pullAlias.trim()}`);
      const imgs = await infraApi.listImages();
      setImages(imgs);
      setPullOpen(false);
      setPullAlias("");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!stage4Complete) return;
    setBusy(true);
    try {
      const config: Record<string, string> = {};
      if (memory.trim()) config[LIMIT_KEYS.memory] = memory.trim();
      if (cpu.trim()) config[LIMIT_KEYS.cpu] = cpu.trim();
      const devices: Record<string, Record<string, string>> | undefined = network
        ? { eth0: { nictype: "bridged", parent: network } }
        : undefined;
      const result = await instancesApi.create({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        profiles,
        source: { type: "image", fingerprint: imageFingerprint },
        config,
        devices,
      });
      if (result && "type" in result && result.type === "async") {
        const op = await operationsApi.wait(result.operation);
        if (op.status !== "Success") throw new Error(op.err ?? "Create failed");
      }
      toast("success", `Instance ${name.trim()} created`);
      void loadInstances(project).catch(() => {});
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Window
      open={open}
      onClose={onClose}
      title="Create instance"
      subtitle={`Stage ${stage} of 4`}
      footer={
        <>
          {stage > 1 && <Button variant="secondary" onClick={back} data-testid="wizard-back">Back</Button>}
          {stage < 4 && <Button onClick={next} disabled={stage === 1 ? !nameValid : stage === 2 ? !stage2Complete : false} data-testid="wizard-next">Next</Button>}
          {stage === 4 && <Button onClick={create} loading={busy} data-testid="wizard-create">Create</Button>}
        </>
      }
    >
      <div data-testid="wizard-stage">
        {stage === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(["container", "virtual-machine"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`wizard-type-${t}`}
                  onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-2 rounded border p-4 ${type === t ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-700"}`}
                >
                  {t === "container" ? <Box size={22} /> : <Monitor size={22} />}
                  <span className="text-[13px] font-medium">{t === "container" ? "Container" : "Virtual machine"}</span>
                </button>
              ))}
            </div>
            <Input label="Name" name="wizard-name" data-testid="wizard-name" value={name} onChange={(e) => setName(e.target.value)} error={name && !nameValid ? "Name must contain only letters, numbers, and hyphens" : undefined} />
            <Input label="Description (optional)" name="wizard-description" data-testid="wizard-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        )}
        {stage === 2 && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-text-tertiary" />
              <input
                data-testid="wizard-image-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search images…"
                className="h-8 w-full rounded border border-border bg-surface-500 pl-8 pr-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-auto">
              {filteredImages.length === 0 && <p className="py-4 text-center text-xs text-text-tertiary">No images for this type.</p>}
              {filteredImages.map((img) => (
                <button
                  key={img.fingerprint}
                  type="button"
                  data-testid={`wizard-image-${img.fingerprint}`}
                  onClick={() => setImageFingerprint(img.fingerprint)}
                  className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-[13px] ${imageFingerprint === img.fingerprint ? "border-accent-600 bg-accent-600/10 text-text-primary" : "border-border text-text-secondary hover:bg-surface-700"}`}
                >
                  <span className="truncate">{img.properties?.description ?? img.description ?? img.filename}</span>
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-text-tertiary">{img.fingerprint.slice(0, 8)}</span>
                </button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPullOpen((o) => !o)} data-testid="wizard-pull-toggle">
              <RefreshCw size={13} /> Pull from remote
            </Button>
            {pullOpen && (
              <div className="space-y-2 rounded border border-border bg-surface-900 p-3">
                <Input label="Alias" name="pull-alias" data-testid="wizard-pull-alias" value={pullAlias} onChange={(e) => setPullAlias(e.target.value)} placeholder="ubuntu/24.04" />
                <Input label="Server" name="pull-server" data-testid="wizard-pull-server" value={pullServer} onChange={(e) => setPullServer(e.target.value)} />
                <Button size="sm" onClick={pull} loading={busy} data-testid="wizard-pull-submit">Pull</Button>
              </div>
            )}
          </div>
        )}
        {stage === 3 && (
          <div className="space-y-4">
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-text-secondary">Profiles</legend>
              <div className="flex flex-wrap gap-3">
                {profileList.map((p) => (
                  <Checkbox key={p.name} label={p.name} data-testid={`wizard-profile-${p.name}`} checked={profiles.includes(p.name)} onChange={(e) => {
                    if (e.target.checked) setProfiles((prev) => [...prev, p.name]);
                    else setProfiles((prev) => prev.filter((n) => n !== p.name));
                  }} />
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Memory limit (e.g. 512MiB)" name="wizard-memory" data-testid="wizard-memory" value={memory} onChange={(e) => setMemory(e.target.value)} />
              <Input label="CPU limit (e.g. 2)" name="wizard-cpu" data-testid="wizard-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <Select label="Network" name="wizard-network" data-testid="wizard-network" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">— none —</option>
              {networkList.map((n) => (
                <option key={n.name} value={n.name}>{n.name}</option>
              ))}
            </Select>
          </div>
        )}
        {stage === 4 && (
          <div data-testid="wizard-summary" className="space-y-1.5 text-[13px]">
            <p><span className="text-text-tertiary">Name:</span> {name.trim()}</p>
            <p><span className="text-text-tertiary">Type:</span> {type === "container" ? "Container" : "Virtual machine"}</p>
            <p><span className="text-text-tertiary">Image:</span> {filteredImages.find((i) => i.fingerprint === imageFingerprint)?.properties?.description ?? imageFingerprint.slice(0, 8)}</p>
            <p><span className="text-text-tertiary">Profiles:</span> {profiles.join(", ") || "—"}</p>
            {memory.trim() && <p><span className="text-text-tertiary">Memory:</span> {memory.trim()}</p>}
            {cpu.trim() && <p><span className="text-text-tertiary">CPU:</span> {cpu.trim()}</p>}
            {network && <p><span className="text-text-tertiary">Network:</span> {network}</p>}
          </div>
        )}
      </div>
    </Window>
  );
}
