import { useCallback, useEffect, useMemo, useState } from "react";
import { instancesApi, serverApi } from "../../api";
import type { Instance } from "../../api/types";
import { KeyValueEditor } from "../../components/key-value-editor";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Switch } from "../../components/switch";
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
  registerActions?: (actions: ConfigActions | null) => void;
}

export function ConfigTab({ instanceName, registerActions }: ConfigTabProps) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [expanded, setExpanded] = useState<Instance | null>(null);
  const [effective, setEffective] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [initialConfig, setInitialConfig] = useState<Record<string, string>>({});
  const [initialDescription, setInitialDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const refresh = useCallback(() => {
    instancesApi.get(instanceName).then((i) => {
      setInstance(i);
      setConfig(i.config);
      setDescription(i.description);
      setInitialConfig(i.config);
      setInitialDescription(i.description);
      setErrors({});
      setSelectedKeys([]);
    }).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!effective) return;
    instancesApi.get(instanceName).then(setExpanded).catch(() => {});
  }, [effective, instanceName]);

  useEffect(() => {
    void serverApi.metadata()
      .then((m) => {
        const map: Record<string, string> = {};
        for (const c of m.configs ?? []) if (c.key) map[c.key] = c.description;
        setDescriptions(map);
      })
      .catch(() => {});
  }, []);

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
      await instancesApi.update(instanceName, { config, description });
      toast("success", "Configuration saved");
      setInitialConfig(config);
      setInitialDescription(description);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    }
  }, [instanceName, config, description]);

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

  const override = useCallback(
    (key: string, value: unknown) => {
      setConfig((prev) => ({ ...prev, [key]: value !== undefined ? String(value) : "" }));
      setEffective(false);
      toast("info", `Overrode ${key} from its source — review and save`);
    },
    []
  );

  if (!instance) return <div data-testid="config-tab">Loading…</div>;

  return (
    <div data-testid="config-tab">
      <div className="flex items-center gap-3 px-3 pt-3">
        <Switch dataTestId="effective-toggle" checked={effective} onChange={setEffective} label="Effective config" />
      </div>
      {effective ? (
        <div className="p-3">
          <table className="w-full border-collapse text-[13px]" data-testid="provenance-table">
            <thead className="border-b border-border bg-surface-700 text-left text-xs text-text-secondary">
              <tr>
                <th className="px-2 py-1">Key</th>
                <th className="px-2 py-1">Value</th>
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface-800">
              {Object.entries(expanded?.config ?? {}).map(([key, value]) => (
                <tr key={key} data-testid={`provenance-row-${key}`}>
                  <td data-testid={`provenance-key-${key}`} className="px-2 py-1.5 font-mono text-xs text-text-primary">{key}</td>
                  <td data-testid={`provenance-value-${key}`} className="px-2 py-1.5 text-sm text-text-primary">{value}</td>
                  <td className="px-2 py-1.5">
                    <span data-testid={`provenance-source-${key}`}>
                      <Badge tone="info">local</Badge>
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Button size="sm" variant="ghost" data-testid={`override-${key}`} onClick={() => override(key, value)}>Override</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <KeyValueEditor
            values={config}
            onChange={setConfig}
            dataTestId="config-editor"
            descriptions={descriptions}
            description={description}
            onDescriptionChange={setDescription}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            showToolbar={false}
          />
          {Object.values(errors)[0] && <p className="px-3 py-2 text-xs text-red-300">{Object.values(errors)[0]}</p>}
        </>
      )}
    </div>
  );
}
