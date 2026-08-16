import { useCallback, useEffect, useMemo, useState } from "react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { KeyValueEditor } from "../../components/key-value-editor";
import { toast } from "../../components/toast";
import { validateConfigKey } from "../../lib/config";

export interface ConfigActions {
  save: () => Promise<void>;
  cancel: () => void;
  removeSelected: () => void;
  dirty: boolean;
  selectedCount: number;
}

export interface ConfigTabProps {
  instanceName: string;
  project?: string;
  registerActions?: (actions: ConfigActions | null) => void;
}

export function ConfigTab({ instanceName, project, registerActions }: ConfigTabProps) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [initialConfig, setInitialConfig] = useState<Record<string, string>>({});
  const [initialDescription, setInitialDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const refresh = useCallback(() => {
    instancesApi.get(instanceName, project).then((i) => {
      setInstance(i);
      setConfig(i.config);
      setDescription(i.description);
      setInitialConfig(i.config);
      setInitialDescription(i.description);
      setErrors({});
      setSelectedKeys([]);
    }).catch(() => {});
  }, [instanceName, project]);

  useEffect(refresh, [refresh]);

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initialConfig) || description !== initialDescription,
    [config, initialConfig, description, initialDescription]
  );

  const save = useCallback(async () => {
    const nextErrors: Record<string, string> = {};
    for (const key of Object.keys(config)) {
      const error = validateConfigKey(key);
      if (error) nextErrors[key] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    try {
      await instancesApi.update(instanceName, { config, description }, project);
      toast("success", "Configuration saved");
      setInitialConfig(config);
      setInitialDescription(description);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    }
  }, [instanceName, config, description, project]);

  const cancel = useCallback(() => {
    setConfig(initialConfig);
    setDescription(initialDescription);
    setErrors({});
    setSelectedKeys([]);
  }, [initialConfig, initialDescription]);

  const removeSelected = useCallback(() => {
    if (selectedKeys.length === 0) return;
    const next = { ...config };
    let clearDescription = false;
    for (const key of selectedKeys) {
      if (key === "__description__") {
        clearDescription = true;
        continue;
      }
      delete next[key];
    }
    setConfig(next);
    if (clearDescription) setDescription("");
    setSelectedKeys([]);
  }, [config, selectedKeys]);

  useEffect(() => {
    registerActions?.({ save, cancel, removeSelected, dirty, selectedCount: selectedKeys.length });
    return () => registerActions?.(null);
  }, [registerActions, save, cancel, removeSelected, dirty, selectedKeys.length]);


  if (!instance) return <div data-testid="config-tab">Loading…</div>;

  return (
    <div data-testid="config-tab">
      <KeyValueEditor
        values={config}
        onChange={setConfig}
        dataTestId="config-editor"
        description={description}
        onDescriptionChange={setDescription}
        selectedKeys={selectedKeys}
        onSelectionChange={setSelectedKeys}
        showToolbar={false}
        stickyHeader
      />
      {Object.values(errors)[0] && <p className="px-3 py-2 text-xs text-red-300">{Object.values(errors)[0]}</p>}
    </div>
  );
}
