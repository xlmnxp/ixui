import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { KeyValueEditor } from "../../components/key-value-editor";
import { Input } from "../../components/input";
import { Button } from "../../components/button";
import { toast } from "../../components/toast";
import { validateConfigKey } from "../../lib/config";

export interface ConfigTabProps {
  instanceName: string;
}

export function ConfigTab({ instanceName }: ConfigTabProps) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => {
    instancesApi.get(instanceName).then((i) => {
      setInstance(i);
      setConfig(i.config);
      setDescription(i.description);
    }).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  const save = async () => {
    const nextErrors: Record<string, string> = {};
    for (const key of Object.keys(config)) {
      const error = validateConfigKey(key);
      if (error) nextErrors[key] = error;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      await instancesApi.update(instanceName, { config, description });
      toast("success", "Configuration saved");
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!instance) return <div data-testid="config-tab">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-4" data-testid="config-tab">
      <Input label="Description" name="config-description" data-testid="config-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div>
        <div className="mb-1 text-xs font-medium text-text-secondary">Configuration</div>
        <KeyValueEditor values={config} onChange={setConfig} dataTestId="config-editor" />
      </div>
      {Object.values(errors)[0] && <p className="text-xs text-red-300">{Object.values(errors)[0]}</p>}
      <div className="flex gap-2">
        <Button onClick={save} loading={saving} data-testid="config-save">Save</Button>
        <Button variant="secondary" onClick={refresh} data-testid="config-reset">Reset</Button>
      </div>
    </div>
  );
}
