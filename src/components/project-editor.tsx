import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { infraApi, serverApi } from "../api";
import type { Project } from "../api/types";
import { Dialog } from "./dialog";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";
import { Input } from "./input";
import { Progress } from "./progress";
import { toast } from "./toast";

export interface ProjectKeyMeta {
  label: string;
  type: "checkbox" | "number" | "text";
  description: string;
}

export const PROJECT_KEY_META: Record<string, ProjectKeyMeta> = {
  "features.images": {
    label: "Images",
    type: "checkbox",
    description: "Allow creating and managing images in this project.",
  },
  "features.networks": {
    label: "Networks",
    type: "checkbox",
    description: "Allow creating and managing networks in this project.",
  },
  "features.profiles": {
    label: "Profiles",
    type: "checkbox",
    description: "Allow creating and managing profiles in this project.",
  },
  "features.storage.volumes": {
    label: "Volumes",
    type: "checkbox",
    description: "Allow creating and managing storage volumes in this project.",
  },
  "limits.cpu": {
    label: "CPU",
    type: "text",
    description: "Maximum number of CPU cores, e.g. 2 or 1.5.",
  },
  "limits.memory": {
    label: "Memory",
    type: "text",
    description: "Maximum memory, e.g. 4GB.",
  },
  "limits.disk": {
    label: "Disk",
    type: "text",
    description: "Maximum disk usage, e.g. 10GB.",
  },
  "limits.instances": {
    label: "Instances",
    type: "number",
    description: "Maximum number of instances.",
  },
  "limits.containers": {
    label: "Containers",
    type: "number",
    description: "Maximum number of containers.",
  },
  "limits.virtual-machines": {
    label: "Virtual machines",
    type: "number",
    description: "Maximum number of virtual machines.",
  },
  "limits.networks": {
    label: "Networks",
    type: "number",
    description: "Maximum number of networks.",
  },
  "limits.processes": {
    label: "Processes",
    type: "number",
    description: "Maximum number of processes per instance.",
  },
  "restricted.containers.nesting": {
    label: "Container nesting",
    type: "checkbox",
    description: "Allow nested containers inside containers.",
  },
  "restricted.containers.lowlevel": {
    label: "Low-level container features",
    type: "checkbox",
    description: "Allow low-level container features like device passing and kernel modules.",
  },
  "restricted.devices.disk": {
    label: "Disk devices",
    type: "checkbox",
    description: "Allow attaching disk devices to instances.",
  },
  "restricted.devices.nic": {
    label: "Network interface devices",
    type: "checkbox",
    description: "Allow attaching network interface devices to instances.",
  },
  "restricted.networks.access": {
    label: "Network access",
    type: "checkbox",
    description: "Allow instances to access the project networks.",
  },
  "restricted.networks.uplinks": {
    label: "Network uplinks",
    type: "checkbox",
    description: "Allow instances to use uplink networks.",
  },
};

const FEATURE_KEYS = ["features.images", "features.networks", "features.profiles", "features.storage.volumes"];
const LIMIT_KEYS = [
  "limits.cpu",
  "limits.memory",
  "limits.disk",
  "limits.instances",
  "limits.containers",
  "limits.virtual-machines",
  "limits.networks",
  "limits.processes",
];
const RESTRICTED_KEYS = [
  "restricted.containers.nesting",
  "restricted.containers.lowlevel",
  "restricted.devices.disk",
  "restricted.devices.nic",
  "restricted.networks.access",
  "restricted.networks.uplinks",
];

const FEATURE_PREFIX = "features.";
const LIMIT_PREFIX = "limits.";
const RESTRICTED_PREFIX = "restricted.";

function dashed(key: string, prefix: string): string {
  return key.slice(prefix.length).replaceAll(".", "-");
}

export interface ProjectEditorProps {
  project: Project;
  usage?: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectEditor({ project, usage = {}, onClose, onSaved }: ProjectEditorProps) {
  const [config, setConfig] = useState<Record<string, string>>(() => ({ ...project.config }));
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void serverApi
      .metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        for (const c of m.configs ?? []) if (c.key) map[c.key] = c.description;
        setDescriptions(map);
      })
      .catch(() => {});
  }, []);

  const setKey = (key: string, value: string | undefined) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const descriptionFor = (key: string): string => descriptions[key] ?? PROJECT_KEY_META[key]?.description ?? "";

  const usageFor = (key: string): number | null => {
    const used = usage[key];
    const limit = parseFloat(config[key] ?? "");
    if (used === undefined || !Number.isFinite(limit) || limit <= 0) return null;
    return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
  };

  const save = async () => {
    setBusy(true);
    try {
      await infraApi.updateProject(project.name, { config });
      toast("success", `Project ${project.name} saved`);
      onSaved();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit project ${project.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-testid="project-editor-cancel"><X size={14} /> Cancel</Button>
          <Button onClick={save} loading={busy} data-testid="project-editor-save"><Check size={14} /> Save</Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="project-editor">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Features</h3>
          <div className="space-y-2">
            {FEATURE_KEYS.map((key) => (
              <div key={key}>
                <Checkbox
                  label={PROJECT_KEY_META[key]?.label}
                  data-testid={`project-feature-${dashed(key, FEATURE_PREFIX)}`}
                  checked={config[key] === "true"}
                  onChange={(e) => setKey(key, e.target.checked ? "true" : undefined)}
                />
                <p className="text-xs text-text-tertiary">{descriptionFor(key)}</p>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Limits</h3>
          <div className="space-y-3">
            {LIMIT_KEYS.map((key) => {
              const percent = usageFor(key);
              return (
                <div key={key}>
                  <Input
                    label={PROJECT_KEY_META[key]?.label}
                    name={`project-limit-${dashed(key, LIMIT_PREFIX)}`}
                    data-testid={`project-limit-${dashed(key, LIMIT_PREFIX)}`}
                    type={PROJECT_KEY_META[key]?.type}
                    value={config[key] ?? ""}
                    onChange={(e) => setKey(key, e.target.value)}
                  />
                  <p className="text-xs text-text-tertiary">{descriptionFor(key)}</p>
                  {percent !== null && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={percent} tone={percent >= 100 ? "danger" : "accent"} />
                      <span className="shrink-0 text-xs text-text-tertiary">{percent}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">Restricted</h3>
          <div className="space-y-3">
            {RESTRICTED_KEYS.map((key) => (
              <div key={key} data-testid={`project-restricted-${dashed(key, RESTRICTED_PREFIX)}`}>
                <Switch
                  label={PROJECT_KEY_META[key]?.label}
                  checked={config[key] === "true"}
                  onChange={(checked) => setKey(key, checked ? "true" : undefined)}
                />
                <p className="text-xs text-text-tertiary">{descriptionFor(key)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Dialog>
  );
}
