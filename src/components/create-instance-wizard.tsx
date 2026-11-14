import { useEffect, useMemo, useState } from "react";
import { Box, Monitor, Plus } from "lucide-react";
import { ReviewList, StepDialog } from "./step-dialog";
import { CreateInstanceIcon } from "./create-instance-icon";
import type { Step } from "./step-dialog";
import { Input } from "./input";
import { SegmentedControl } from "./segmented-control";
import { Select } from "./select";
import { Checkbox } from "./checkbox";
import { ImagePicker } from "./image-picker";
import type { PickedImage } from "./image-picker";
import { instancesApi, infraApi } from "../api";
import { loadInstances } from "../state/instances";
import { projectsStore, currentProjectStore } from "../state/projects";
import { ALL_PROJECTS } from "../api/client";
import { useStore } from "../state/store";
import { toast } from "./toast";
import { validateInstanceName } from "../lib/instance-name";
import type { Profile, Network } from "../api/types";

export interface CreateInstanceWizardProps {
  open: boolean;
  onClose: () => void;
  targetMember?: string;
}

const LIMIT_KEYS: Record<"memory" | "cpu", string> = { memory: "limits.memory", cpu: "limits.cpu" };

export function CreateInstanceWizard({ open, onClose, targetMember }: CreateInstanceWizardProps) {
  const currentProject = useStore(currentProjectStore);
  const projects = useStore(projectsStore);
  const [project, setProject] = useState<string>(currentProject === ALL_PROJECTS ? "default" : currentProject);
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [name, setName] = useState("");
  /** Only surface the empty-name message once the user has interacted with the field. */
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [profiles, setProfiles] = useState<string[]>(["default"]);
  const [memory, setMemory] = useState("");
  const [cpu, setCpu] = useState("");
  const [network, setNetwork] = useState("");
  const [profileList, setProfileList] = useState<Profile[]>([]);
  const [networkList, setNetworkList] = useState<Network[]>([]);
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setType("container");
    setName("");
    setNameTouched(false);
    setCreateError("");
    setDescription("");
    setPicked(null);
    setProfiles(["default"]);
    setMemory("");
    setCpu("");
    setNetwork("");
    setBusy(false);
    setProject(currentProject === ALL_PROJECTS ? "default" : currentProject);
  }, [open, currentProject]);

  useEffect(() => {
    if (!open) return;
    void Promise.all([infraApi.listProfiles(project), infraApi.listNetworks(project)])
      .then(([profs, nets]) => {
        setProfileList(profs);
        setNetworkList(nets);
        if (!profs.some((p) => p.name === "default")) setProfiles([]);
      })
      .catch(() => {});
  }, [open, project]);

  useEffect(() => {
    setPicked(null);
  }, [type]);

  const nameError = validateInstanceName(name);
  const nameValid = nameError === null;

  const cloudInitEnabled = useMemo(
    () =>
      profileList.some(
        (p) => profiles.includes(p.name) && Object.keys(p.config).some((k) => k.startsWith("cloud-init."))
      ),
    [profileList, profiles]
  );

  const create = async () => {
    if (!nameValid || !picked) return;
    setBusy(true);
    setCreateError("");
    try {
      const config: Record<string, string> = {};
      if (memory.trim()) config[LIMIT_KEYS.memory] = memory.trim();
      if (cpu.trim()) config[LIMIT_KEYS.cpu] = cpu.trim();
      const devices: Record<string, Record<string, string>> | undefined = network
        ? { eth0: { nictype: "bridged", parent: network } }
        : undefined;
      const source = picked.fingerprint
        ? { type: "image" as const, fingerprint: picked.fingerprint }
        : { type: "image" as const, server: picked.server, protocol: picked.protocol, alias: picked.alias };
      const result = await instancesApi.create({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        profiles,
        source,
        config,
        devices,
      }, targetMember, project);
      // Fire and forget: the daemon runs the create as an operation, so the
      // window closes immediately and the operations pane tracks progress.
      if (result && "type" in result && result.type === "async") {
        toast("info", `Creating ${name.trim()}…`);
      } else {
        toast("success", `Instance ${name.trim()} created`);
      }
      void loadInstances(project).catch(() => {});
      onClose();
    } catch (err) {
      // Only reachable when the request itself is rejected; keep the window up.
      const message = err instanceof Error ? err.message : "Create failed";
      setCreateError(message);
      toast("danger", message);
    } finally {
      setBusy(false);
    }
  };

  // Anything typed here would be lost if the window closed silently.
  const dirty =
    name.trim() !== "" ||
    description.trim() !== "" ||
    picked !== null ||
    memory.trim() !== "" ||
    cpu.trim() !== "" ||
    network !== "";

  const steps: Step[] = [
    {
      key: "basics",
      title: "Type & name",
      invalid: nameValid ? null : name ? nameError : "Enter an instance name",
      hideHint: true,
      content: (
        <div className="space-y-4">
          <Input
            label="Name"
            name="wizard-name"
            data-testid="wizard-name"
            placeholder="web1"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            onBlur={() => setNameTouched(true)}
            error={nameValid ? undefined : name ? nameError : nameTouched ? "Enter an instance name" : undefined}
          />
          <SegmentedControl
            label="Type"
            value={type}
            dataTestId="wizard-type"
            onChange={setType}
            options={[
              { value: "container", label: "Container", icon: <Box size={13} /> },
              { value: "virtual-machine", label: "Virtual machine", icon: <Monitor size={13} /> },
            ]}
          />
          <Input label="Description (optional)" name="wizard-description" data-testid="wizard-description" placeholder="What is this instance for?" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Select label="Project" name="wizard-project" data-testid="wizard-project" value={project} onChange={(e) => setProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      key: "image",
      title: "Image",
      invalid: picked ? null : "Pick an image from the list",
      hideHint: true,
      content: (
        <div className="space-y-2">
          {/* Always visible, so the next action never depends on scrolling. */}
          <p className="text-xs text-text-tertiary" data-testid="wizard-image-hint">
            Pick an image from the list
          </p>
          <ImagePicker key={type} type={type} cloudInitEnabled={cloudInitEnabled} value={picked} onSelect={setPicked} />
        </div>
      ),
    },
    {
      key: "config",
      title: "Configuration",
      content: (
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
            <Input label="Memory limit (e.g. 512MiB)" name="wizard-memory" placeholder="512MiB" data-testid="wizard-memory" value={memory} onChange={(e) => setMemory(e.target.value)} />
            <Input label="CPU limit (e.g. 2)" name="wizard-cpu" placeholder="2" data-testid="wizard-cpu" value={cpu} onChange={(e) => setCpu(e.target.value)} />
          </div>
          <Select label="Network" name="wizard-network" data-testid="wizard-network" value={network} onChange={(e) => setNetwork(e.target.value)}>
            <option value="">— none —</option>
            {networkList.map((n) => (
              <option key={n.name} value={n.name}>{n.name}</option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      key: "review",
      title: "Review",
      content: (
        <div data-testid="wizard-summary">
          <ReviewList
            rows={[
              { label: "Name", value: name.trim() || "—" },
              { label: "Project", value: project },
              { label: "Type", value: type === "container" ? "Container" : "Virtual machine" },
              { label: "Image", value: picked?.fingerprint ? `${picked.alias} (cached local image)` : picked?.alias ?? "—" },
              { label: "Profiles", value: profiles.join(", ") || "—" },
              ...(memory.trim() ? [{ label: "Memory", value: memory.trim() }] : []),
              ...(cpu.trim() ? [{ label: "CPU", value: cpu.trim() }] : []),
              ...(network ? [{ label: "Network", value: network }] : []),
              ...(targetMember ? [{ label: "Target member", value: targetMember }] : []),
            ]}
          />
          {createError && (
            <p className="mt-3 rounded bg-danger/10 px-2 py-1 text-xs text-red-300" role="alert" data-testid="wizard-create-error">
              {createError}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <StepDialog
      open={open}
      onClose={onClose}
      title="Create instance"
      steps={steps}
      busy={busy}
      dirty={dirty}
      discardMessage="The instance has not been created yet. Discard these settings?"
      windowMode
      windowIcon={<CreateInstanceIcon size={15} />}
      windowWidth={1120}
      windowBodyHeight="min(700px, calc(100vh - 190px))"
      submitLabel="Create"
      submitIcon={<Plus size={14} />}
      onSubmit={create}
    />
  );
}
