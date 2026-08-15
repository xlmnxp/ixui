import { useCallback, useEffect, useState } from "react";
import { Monitor, RefreshCw } from "lucide-react";
import { instancesApi } from "../api";
import type { Instance, InstanceStateInfo } from "../api/types";
import { Badge } from "../components/badge";
import { Button } from "../components/button";
import { KeyValueTable } from "../components/key-value-table";
import { Spinner } from "../components/spinner";
import { instanceStatusTone, instanceIps } from "../lib/instance-status";

export interface OverviewTabProps {
  instance: Instance;
}

export function OverviewTab({ instance }: OverviewTabProps) {
  const [state, setState] = useState<InstanceStateInfo | null>(null);
  const [screenshot, setScreenshot] = useState<{ url: string } | null>(null);
  const [screenshotState, setScreenshotState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void instancesApi.state(instance.name, instance.project).then(setState).catch(() => setState(null));
  }, [instance.name, instance.project]);

  const loadScreenshot = useCallback(async (bust: boolean) => {
    setScreenshotState("loading");
    try {
      const url = instancesApi.screenshotUrl(instance.name, instance.project);
      const res = await fetch(bust ? `${url}&_=${Date.now()}` : url, { credentials: "include" });
      if (!res.ok) throw new Error(`Screenshot failed (${res.status})`);
      const blob = await res.blob();
      setScreenshot((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob) };
      });
      setScreenshotState("ready");
    } catch {
      setScreenshot((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setScreenshotState("error");
    }
  }, [instance.name, instance.project]);

  useEffect(() => {
    if (instance.type !== "virtual-machine") return;
    void loadScreenshot(false);
    return () => {
      setScreenshot((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
    };
  }, [loadScreenshot, instance.type]);

  const ips = instanceIps(state);

  const rows = [
    { key: "Status", value: <Badge tone={instanceStatusTone(instance.status)}>{instance.status}</Badge> },
    { key: "Type", value: instance.type === "container" ? "Container" : "Virtual machine" },
    { key: "Created", value: new Date(instance.created_at).toLocaleString() },
    { key: "Last used", value: instance.last_used_at ? new Date(instance.last_used_at).toLocaleString() : "Never" },
    { key: "Profiles", value: instance.profiles.join(", ") || "—" },
    ...(ips.length > 0
      ? ips.map((ip) => ({ id: `ip-${ip}`, key: "IP address", value: ip }))
      : [{ key: "IP addresses", value: "—" }]),
    { key: "Memory limit", value: instance.config["limits.memory"] ?? "—" },
    { key: "CPU limit", value: instance.config["limits.cpu"] ?? "—" },
  ];

  return (
    <div data-testid="overview-tab">
      {instance.type === "virtual-machine" && (
        <div className="border-b border-border p-3" data-testid="console-preview">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Console preview</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" data-testid="screenshot-refresh" onClick={() => void loadScreenshot(true)}>
                <RefreshCw size={14} /> Refresh
              </Button>
              <Button
                size="sm"
                variant="secondary"
                data-testid="screenshot-open-console"
                onClick={() =>
                  window.open(
                    `/ui/terminal/${instance.name}?project=${encodeURIComponent(instance.project)}`,
                    `terminal-${instance.name}`,
                    "width=1000,height=640"
                  )
                }
              >
                <Monitor size={14} /> Open console
              </Button>
            </div>
          </div>
          <div
            className="flex min-h-40 items-center justify-center rounded border border-border bg-surface-950 p-2"
            data-testid="screenshot-area"
          >
            {screenshotState === "loading" && (
              <span className="flex items-center gap-2 text-sm text-text-secondary" data-testid="screenshot-loading">
                <Spinner size="sm" /> Taking screenshot…
              </span>
            )}
            {screenshotState === "ready" && screenshot && (
              <img
                src={screenshot.url}
                alt={`${instance.name} console`}
                data-testid="screenshot-image"
                className="max-h-72 w-auto max-w-full rounded"
              />
            )}
            {screenshotState === "error" && (
              <p className="text-xs text-text-secondary" data-testid="screenshot-error">
                Screenshot unavailable — is the instance running?
              </p>
            )}
          </div>
        </div>
      )}
      <KeyValueTable rows={rows} />
      {instance.description && <p className="mt-2 border-t border-border px-3 py-2 text-sm text-text-secondary">{instance.description}</p>}
    </div>
  );
}
