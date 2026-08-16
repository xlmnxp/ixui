import { useEffect } from "react";
import { Check, Clock } from "lucide-react";
import { Button } from "./button";
import { Switch } from "./switch";
import { useStore } from "../state/store";
import { metadataStore, metadataLongStore, loadMetadata, configDescription } from "../state/metadata";

export interface SnapshotScheduleProps {
  schedule: string;
  expiry: string;
  enabled: boolean;
  busy?: boolean;
  onScheduleChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onSave: () => void;
  dataTestId?: string;
}

/** Compact card for editing the snapshots.schedule / snapshots.expiry instance config keys. */
export function SnapshotSchedule({
  schedule,
  expiry,
  enabled,
  busy = false,
  onScheduleChange,
  onExpiryChange,
  onEnabledChange,
  onSave,
  dataTestId = "snapshot-schedule",
}: SnapshotScheduleProps) {
  const metadataDescriptions = useStore(metadataStore);
  const metadataLongs = useStore(metadataLongStore);

  useEffect(() => {
    loadMetadata();
  }, []);

  const scheduleHint = configDescription(metadataDescriptions, "snapshots.schedule", metadataLongs);
  const expiryHint = configDescription(metadataDescriptions, "snapshots.expiry", metadataLongs);

  return (
    <div className={`m-3 overflow-hidden rounded border border-border ${enabled ? "" : "opacity-60"}`} data-testid={dataTestId}>
      <div className="flex items-center justify-between border-b border-border bg-surface-700 px-2 py-1">
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Clock size={12} /> Automatic snapshots
        </span>
        <span className="flex items-center gap-2">
          <Switch checked={enabled} onChange={onEnabledChange} dataTestId="schedule-enable" />
          <Button size="sm" variant="ghost" loading={busy} data-testid="schedule-save" onClick={onSave}><Check size={13} /> Save</Button>
        </span>
      </div>
      {enabled && (
        <table className="w-full table-fixed border-separate border-spacing-0 bg-surface-800 text-[13px]">
          <tbody className="divide-y divide-border">
            <tr>
              <td className="w-44 px-2 py-1.5 align-top">
                <div className="font-mono text-xs text-text-primary">snapshots.schedule</div>
                {scheduleHint && <div className="mt-0.5 text-[11px] font-sans text-text-tertiary" data-testid="schedule-hint">{scheduleHint}</div>}
              </td>
              <td className="px-2 py-1.5 align-top">
                <input
                  data-testid="schedule-input"
                  value={schedule}
                  onChange={(e) => onScheduleChange(e.target.value)}
                  placeholder="@daily"
                  className="h-8 w-full rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none"
                />
              </td>
            </tr>
            <tr>
              <td className="w-44 px-2 py-1.5 align-top">
                <div className="font-mono text-xs text-text-primary">snapshots.expiry</div>
                {expiryHint && <div className="mt-0.5 text-[11px] font-sans text-text-tertiary" data-testid="expiry-hint">{expiryHint}</div>}
              </td>
              <td className="px-2 py-1.5 align-top">
                <input
                  data-testid="expiry-input"
                  value={expiry}
                  onChange={(e) => onExpiryChange(e.target.value)}
                  placeholder="1d"
                  className="h-8 w-full rounded border border-border bg-surface-500 px-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-500 focus:outline-none"
                />
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
