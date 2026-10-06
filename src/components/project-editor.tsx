import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { infraApi } from "../api";
import type { Project } from "../api/types";
import { ReviewList, StepDialog } from "./step-dialog";
import type { Step } from "./step-dialog";
import { Checkbox } from "./checkbox";
import { Switch } from "./switch";
import { Input } from "./input";
import { Progress } from "./progress";
import { toast } from "./toast";
import { currentProjectStore } from "../state/projects";
import { loadMetadata, metadataStore, configDescription } from "../state/metadata";
import { useStore } from "../state/store";
import { BYTE_RESOURCES, usagePercent } from "../lib/project-usage";
import type { ProjectUsage } from "../lib/project-usage";
import { formatBytes } from "../lib/format";

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
  /** The project to edit, or null to create a new one. */
  project: Project | null;
  usage?: Record<string, number>;
  /** Real per-resource usage and limits from the project state endpoint; preferred over `usage`. */
  state?: ProjectUsage;
  onClose: () => void;
  onSaved: () => void;
}

/** Config entries that differ between two configs, for the Review step. */
export function configChanges(before: Record<string, string>, after: Record<string, string>): { key: string; from?: string; to?: string }[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => (before[key] === after[key] ? [] : [{ key, from: before[key], to: after[key] }]));
}

export function ProjectEditor({ project, usage = {}, state, onClose, onSaved }: ProjectEditorProps) {
  const creating = project === null;
  const currentProject = useStore(currentProjectStore);
  const activeProject = project?.name === currentProject;
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [config, setConfig] = useState<Record<string, string>>(() => ({ ...(project?.config ?? {}) }));
  const [busy, setBusy] = useState(false);
  const descriptions = useStore(metadataStore);

  useEffect(() => {
    loadMetadata();
  }, []);

  const setKey = (key: string, value: string | undefined) => {
    setConfig((prev) => {
      const next = { ...prev };
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const descriptionFor = (key: string): string =>
    configDescription(descriptions, key) ?? PROJECT_KEY_META[key]?.description ?? "";

  const usageFor = (key: string): number | null => {
    if (state) return usagePercent(state[key]);
    const used = usage[key];
    const limit = parseFloat(config[key] ?? "");
    if (used === undefined || !Number.isFinite(limit) || limit <= 0) return null;
    return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
  };

  const usageLabel = (key: string): string | null => {
    const u = state?.[key];
    if (!u || u.limit <= 0) return null;
    const fmt = (n: number) => (BYTE_RESOURCES.has(key) ? formatBytes(n) : String(n));
    return `${fmt(u.usage)} / ${fmt(u.limit)}`;
  };

  const save = async () => {
    setBusy(true);
    try {
      if (project) await infraApi.updateProject(project.name, { description: description.trim(), config });
      else await infraApi.createProject({ name: name.trim(), description: description.trim(), config });
      toast("success", `Project ${project?.name ?? name.trim()} ${creating ? "created" : "saved"}`);
      onSaved();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : creating ? "Create failed" : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const nameError = !creating ? null : !name.trim() ? "Enter a project name" : /[^A-Za-z0-9-]/.test(name.trim()) ? "Use letters, numbers and dashes only" : null;
  const limitErrors = LIMIT_KEYS.filter((k) => PROJECT_KEY_META[k]?.type === "number" && config[k] && !/^\d+$/.test(config[k]!));

  const steps: Step[] = [
    {
      key: "basics",
      title: "Basics",
      invalid: nameError,
      content: (
        <div className="space-y-3" data-testid="project-editor">
          <Input label="Name" name="project-name" data-testid="project-name" value={name} disabled={!creating} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" name="project-description" data-testid="project-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          {creating && <p className="text-xs text-text-tertiary">The name can't be changed later.</p>}
        </div>
      ),
    },
    {
      key: "features",
      title: "Features",
      content: (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Enabled features give the project its own copy of that resource type instead of sharing the default project's.</p>
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
      ),
    },
    {
      key: "limits",
      title: "Limits",
      invalid: limitErrors.length > 0 ? `${PROJECT_KEY_META[limitErrors[0]!]?.label ?? limitErrors[0]} must be a whole number` : null,
      content: (
        <div className="space-y-3">
          {!creating && !state && !activeProject && <p className="text-xs text-text-tertiary">Usage shown for the active project</p>}
          {LIMIT_KEYS.map((key) => {
            const percent = usageFor(key);
            const showBar = !creating && (state !== undefined || (activeProject && key !== "limits.disk")) && percent !== null;
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
                {showBar && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={percent} tone={percent >= 100 ? "danger" : "accent"} />
                    <span className="shrink-0 text-xs text-text-tertiary">{usageLabel(key) ?? `${percent}%`}</span>
                  </div>
                )}
                {!creating && !state && !activeProject && key !== "limits.disk" && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-text-tertiary">—</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: "restricted",
      title: "Restrictions",
      content: (
        <div className="space-y-3">
          <p className="text-xs text-text-tertiary">Restrictions only apply when <code>restricted</code> is turned on for the project.</p>
          <Switch
            label="Enable restrictions"
            checked={config["restricted"] === "true"}
            onChange={(checked) => setKey("restricted", checked ? "true" : undefined)}
          />
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
      ),
    },
    {
      key: "review",
      title: "Review",
      content: (
        <div className="space-y-3">
          <ReviewList
            rows={[
              { label: "Name", value: name || "—" },
              { label: "Description", value: description || "—" },
            ]}
          />
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">{creating ? "Settings" : "Changes"}</h3>
            {(() => {
              const changes = configChanges(project?.config ?? {}, config);
              if (changes.length === 0) return <p className="text-xs text-text-tertiary">{creating ? "Defaults — no settings changed." : "No setting changes."}</p>;
              return (
                <ul className="space-y-0.5 font-mono text-xs" data-testid="project-changes">
                  {changes.map((c) => (
                    <li key={c.key}>
                      <span className="text-text-secondary">{c.key}</span>:{" "}
                      {creating ? <span>{c.to}</span> : <><span className="text-text-tertiary line-through">{c.from ?? "unset"}</span> → <span>{c.to ?? "unset"}</span></>}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </div>
      ),
    },
  ];

  return (
    <StepDialog
      open
      onClose={onClose}
      title={creating ? "Create project" : `Edit project ${project.name}`}
      steps={steps}
      busy={busy}
      wide
      freeNavigation={!creating}
      submitLabel={creating ? "Create" : "Save"}
      submitIcon={creating ? <Plus size={14} /> : undefined}
      onSubmit={save}
    />
  );
}
