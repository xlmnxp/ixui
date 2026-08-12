import { useCallback, useEffect, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { instancesApi } from "../../api";
import type { Instance } from "../../api/types";
import { KeyValueEditor } from "../../components/key-value-editor";
import { Button } from "../../components/button";
import { Dialog } from "../../components/dialog";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { EmptyState } from "../../components/empty-state";
import { toast } from "../../components/toast";

const DEVICE_TYPES = ["disk", "nic", "proxy", "gpu", "usb", "pci", "tpm", "none"];

export interface DevicesTabProps {
  instanceName: string;
}

function validateDevice(type: string, props: Record<string, string>): string | null {
  if (type === "nic" && !props.nictype) return "NIC devices require a nictype property";
  if (type === "disk" && (!props.pool || !props.path)) return "Disk devices require pool and path properties";
  if (type === "proxy" && !props.connect) return "Proxy devices require a connect property";
  return null;
}

export interface DeviceActions {
  add: () => void;
}

export function DevicesTab({ instanceName, registerActions }: DevicesTabProps & { registerActions?: (actions: DeviceActions | null) => void }) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftType, setDraftType] = useState("nic");
  const [draftProps, setDraftProps] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const refresh = useCallback(() => {
    instancesApi.get(instanceName).then(setInstance).catch(() => {});
  }, [instanceName]);

  useEffect(refresh, [refresh]);

  const openAdd = useCallback(() => {
    setEditingName(null);
    setDraftName("");
    setDraftType("nic");
    setDraftProps({});
    setError("");
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    registerActions?.({ add: openAdd });
    return () => registerActions?.(null);
  }, [registerActions, openAdd]);

  const openEdit = (name: string) => {
    if (!instance) return;
    const device = instance.devices[name];
    if (!device) return;
    const rest = Object.fromEntries(Object.entries(device).filter(([key]) => key !== "type"));
    setEditingName(name);
    setDraftName(name);
    setDraftType(device.type ?? "none");
    setDraftProps(rest);
    setError("");
    setDialogOpen(true);
  };

  const save = async () => {
    if (!instance) return;
    const name = draftName.trim();
    if (!name) {
      setError("Device name is required");
      return;
    }
    const cleanProps = Object.fromEntries(
      Object.entries(draftProps).filter(([key, value]) => key.trim() !== "" && value.trim() !== "")
    );
    const validation = validateDevice(draftType, cleanProps);
    if (validation) {
      setError(validation);
      return;
    }
    const next = { ...instance.devices };
    if (editingName && editingName !== name) delete next[editingName];
    next[name] = { type: draftType, ...cleanProps };
    setBusy(true);
    try {
      await instancesApi.update(instanceName, { devices: next });
      toast("success", editingName ? `Device ${name} updated` : `Device ${name} added`);
      setDialogOpen(false);
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const updateProps = async (name: string, props: Record<string, string>) => {
    if (!instance) return;
    const clean = Object.fromEntries(Object.entries(props).filter(([key, value]) => key.trim() !== "" && value.trim() !== ""));
    const next = { ...instance.devices, [name]: { ...instance.devices[name], ...clean } };
    setInstance({ ...instance, devices: next });
    try {
      await instancesApi.update(instanceName, { devices: next });
      toast("success", `Device ${name} updated`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
      refresh();
    }
  };

  const remove = async () => {
    if (!instance || !removeTarget) return;
    const name = removeTarget;
    setRemoveTarget(null);
    const next = { ...instance.devices };
    delete next[name];
    setInstance({ ...instance, devices: next });
    try {
      await instancesApi.update(instanceName, { devices: next });
      toast("success", `Device ${name} removed`);
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Remove failed");
      refresh();
    }
  };

  if (!instance) return <div data-testid="devices-tab">Loading…</div>;

  const entries = Object.entries(instance.devices);

  return (
    <div className="space-y-4" data-testid="devices-tab">
      {entries.length === 0 ? (
        <EmptyState title="No devices" description="Devices attach storage, networking, and hardware to this instance." />
      ) : (
        <table className="w-full border-collapse text-[13px]" data-testid="devices-table">
          <thead className="border-b border-border bg-surface-700 text-left text-xs text-text-secondary">
            <tr>
              <th className="px-2 py-1">Name</th>
              <th className="px-2 py-1">Type</th>
              <th className="px-2 py-1">Properties</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface-800">
            {entries.map(([name, props]) => {
              const { type, ...rest } = props;
              return (
                <tr key={name} data-testid={`device-row-${name}`}>
                  <td data-testid={`device-name-${name}`} className="px-2 py-2 align-top font-mono text-xs text-text-primary">{name}</td>
                  <td data-testid={`device-type-${name}`} className="px-2 py-2 align-top text-xs text-text-secondary">{type ?? "none"}</td>
                  <td className="px-2 py-2">
                    <KeyValueEditor values={rest} onChange={(v) => void updateProps(name, v)} dataTestId={`device-props-${name}`} showToolbar={false} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" data-testid={`device-edit-${name}`} aria-label={`Edit ${name}`} onClick={() => openEdit(name)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" data-testid={`device-remove-${name}`} aria-label={`Remove ${name}`} onClick={() => setRemoveTarget(name)}><Trash2 size={14} /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingName ? `Edit device ${editingName}` : "Add device"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}><X size={14} /> Cancel</Button>
            <Button onClick={save} loading={busy} data-testid="device-save"><Check size={14} /> Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" data-testid="device-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          <Select label="Type" data-testid="device-type" value={draftType} onChange={(e) => setDraftType(e.target.value)}>
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <KeyValueEditor values={draftProps} onChange={setDraftProps} dataTestId="device-props-editor" showToolbar={false} />
          {error && <p className="text-xs text-red-300" data-testid="device-error">{error}</p>}
        </div>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        title={`Remove device ${removeTarget ?? ""}`}
        body={`Remove the ${removeTarget ?? ""} device from this instance?`}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => void remove()}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
