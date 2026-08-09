import { useCallback, useEffect, useState } from "react";
import { instancesApi } from "../../api";
import { EmptyState } from "../../components/empty-state";

export interface LogsTabProps {
  instanceName: string;
}

export function LogsTab({ instanceName }: LogsTabProps) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const refresh = useCallback(() => {
    void instancesApi.listLogs(instanceName).then((list) => {
      setFiles(list);
      if (!selected && list[0]) setSelected(list[0]);
    }).catch(() => {});
  }, [instanceName, selected]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!selected) return;
    void instancesApi.readLog(instanceName, selected).then(setContent).catch(() => setContent("(unreadable)"));
  }, [instanceName, selected]);

  if (files.length === 0) return <EmptyState title="No logs" description="This instance has no log files." />;

  return (
    <div className="space-y-3" data-testid="logs-tab">
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <button
            key={file}
            data-testid={`log-file-${file}`}
            onClick={() => setSelected(file)}
            className={`rounded border px-2 py-1 font-mono text-xs ${selected === file ? "border-accent-500 text-accent-300" : "border-border text-text-secondary hover:text-text-primary"}`}
          >
            {file}
          </button>
        ))}
      </div>
      <pre data-testid="log-content" className="max-h-96 overflow-auto rounded border border-border bg-surface-950 p-3 font-mono text-xs text-text-primary">
        {content}
      </pre>
    </div>
  );
}
