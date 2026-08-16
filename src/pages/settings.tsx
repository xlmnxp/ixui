import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Trash2 } from "lucide-react";
import { serverApi } from "../api";
import { ApiError } from "../api/client";
import { KeyValueEditor } from "../components/key-value-editor";
import { Button } from "../components/button";
import { EmptyState } from "../components/empty-state";
import { PageBar } from "../components/page-bar";
import type { BarState } from "../components/page-bar";
import { toast } from "../components/toast";

const MASK = "••••";
const SENSITIVE_PARTS = ["token", "password", "secret", "key"];

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PARTS.some((part) => lower.includes(part));
}

export function maskConfig(config: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, isSensitiveKey(key) ? MASK : value]));
}

export function SettingsPage({ registerBar }: { registerBar?: (bar: BarState | null) => void } = {}) {
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<Record<string, string>>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  const refresh = useCallback(() => {
    void serverApi
      .info()
      .then((info) => {
        const next = info.config ?? {};
        setOriginal(next);
        setConfig(maskConfig(next));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 403) setDenied(true);
      });
  }, []);

  useEffect(refresh, [refresh]);

  const save = async () => {
    setBusy(true);
    try {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(config)) {
        next[key] = isSensitiveKey(key) && value === MASK && key in original ? (original[key] ?? "") : value;
      }
      await serverApi.updateConfig(next);
      toast("success", "Server settings saved");
      refresh();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => setConfig(maskConfig(original));

  const removeSelected = () => {
    if (selectedKeys.length === 0) return;
    const next = { ...config };
    for (const key of selectedKeys) delete next[key];
    setConfig(next);
    setSelectedKeys([]);
  };

  const barActions = useMemo(
    () => [
      <Button key="remove" size="sm" variant="secondary" data-testid="settings-remove" onClick={removeSelected} disabled={selectedKeys.length === 0}><Trash2 size={14} /> Remove</Button>,
      <span key="divider" className="mx-1 h-5 w-px bg-border" />,
      <Button key="reset" size="sm" variant="secondary" data-testid="settings-reset" onClick={reset} disabled={busy}>
        <RotateCcw size={14} /> Reset
      </Button>,
      <Button key="save" size="sm" data-testid="settings-save" onClick={() => void save()} loading={busy}>
        <Save size={14} /> Save
      </Button>,
    ],
    [busy, config, original, selectedKeys, removeSelected]
  );

  useEffect(() => {
    registerBar?.({ title: "Server settings", actions: barActions });
    return () => registerBar?.(null);
  }, [registerBar, barActions]);

  return (
    <div data-testid="settings-page">
      {denied ? (
        <div data-testid="permission-denied">
          <EmptyState title="Permission denied" description="Your account does not have permission to view server settings." />
        </div>
      ) : (
        <>
          {!registerBar && <PageBar title="Server settings" actions={barActions} />}
          {Object.keys(original).length === 0 ? (
            <EmptyState title="—" description="No server config available" />
          ) : (
            <KeyValueEditor values={config} onChange={setConfig} dataTestId="settings-editor" selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys} showToolbar={false} stickyHeader stickyHeaderOffset={40} />
          )}
        </>
      )}
    </div>
  );
}
