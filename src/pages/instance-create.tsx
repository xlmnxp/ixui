import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { infraApi, instancesApi, operationsApi } from "../api";
import { Input } from "../components/input";
import { Select } from "../components/select";
import { Checkbox } from "../components/checkbox";
import { Button } from "../components/button";
import { toast } from "../components/toast";
import { currentProjectStore } from "../state/projects";
import { useStore } from "../state/store";
import type { Image, Profile, AsyncResponse } from "../api/types";

export function InstanceCreatePage() {
  const project = useStore(currentProjectStore);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [images, setImages] = useState<Image[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [imageFingerprint, setImageFingerprint] = useState("");
  const [profileNames, setProfileNames] = useState<string[]>(["default"]);
  const [memory, setMemory] = useState("");
  const [cpu, setCpu] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([infraApi.listImages(), infraApi.listProfiles()]).then(([imgs, profs]) => {
      setImages(imgs);
      setProfiles(profs);
      const first = imgs.find((i) => i.type === type);
      if (first) setImageFingerprint(first.fingerprint);
    }).catch(() => {});
  }, []);

  const filteredImages = images.filter((i) => i.type === type);

  const submit = async () => {
    const trimmed = name.trim();
    if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
      setNameError("Name must contain only letters, numbers, and hyphens");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      const config: Record<string, string> = {};
      if (memory) config["limits.memory"] = memory;
      if (cpu) config["limits.cpu"] = cpu;
      const body = {
        name: trimmed,
        type,
        profiles: profileNames,
        source: imageFingerprint ? { type: "image" as const, fingerprint: imageFingerprint } : undefined,
        config,
        project,
      };
      const result = await instancesApi.create(body);
      if (result && result.type === "async") {
        await operationsApi.wait((result as AsyncResponse).operation);
      }
      toast("success", `Instance ${trimmed} created`);
      navigate(`/instances/${trimmed}`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6" data-testid="instance-create-page">
      <h1 className="text-lg font-semibold text-text-primary">Create instance</h1>
      <div className="space-y-4 rounded-lg border border-border bg-surface-900 p-5">
        <Input label="Name" name="create-name" data-testid="create-name" value={name} onChange={(e) => setName(e.target.value)} error={nameError ?? undefined} />
        <Select label="Type" name="create-type" data-testid="create-type" value={type} onChange={(e) => { setType(e.target.value as "container" | "virtual-machine"); setImageFingerprint(""); }}>
          <option value="container">Container</option>
          <option value="virtual-machine">Virtual machine</option>
        </Select>
        <Select label="Image" name="create-image" data-testid="create-image" value={imageFingerprint} onChange={(e) => setImageFingerprint(e.target.value)}>
          <option value="">— Select image —</option>
          {filteredImages.map((img) => (
            <option key={img.fingerprint} value={img.fingerprint}>
              {img.properties?.description ?? img.description ?? img.filename}
            </option>
          ))}
        </Select>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-text-secondary">Profiles</legend>
          <div className="flex flex-wrap gap-3">
            {profiles.map((p) => (
              <Checkbox
                key={p.name}
                label={p.name}
                checked={profileNames.includes(p.name)}
                onChange={(e) => {
                  if (e.target.checked) setProfileNames((prev) => [...prev, p.name]);
                  else setProfileNames((prev) => prev.filter((n) => n !== p.name));
                }}
              />
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Memory limit (e.g. 512MiB, 2GiB)" name="create-memory" data-testid="create-memory" value={memory} onChange={(e) => setMemory(e.target.value)} />
          <Input label="CPU limit (e.g. 2)" name="create-cpu" data-testid="create-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate("/instances")}>Cancel</Button>
          <Button onClick={submit} loading={submitting} data-testid="create-submit">Create</Button>
        </div>
      </div>
    </div>
  );
}
