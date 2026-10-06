import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { infraApi } from "../api";
import { SIMPLE_STREAMS_DEFAULT } from "../api/simplestreams";
import { ImagePicker } from "./image-picker";
import type { PickedImage } from "./image-picker";
import { Input } from "./input";
import { Select } from "./select";
import { ReviewList, StepDialog } from "./step-dialog";
import type { Step } from "./step-dialog";
import { toast } from "./toast";

export interface PullImageDialogProps {
  open: boolean;
  onClose: () => void;
  onPulled: () => void;
}

type Mode = "catalog" | "manual";

export function PullImageDialog({ open, onClose, onPulled }: PullImageDialogProps) {
  const [mode, setMode] = useState<Mode>("catalog");
  const [type, setType] = useState<"container" | "virtual-machine">("container");
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [alias, setAlias] = useState("");
  const [server, setServer] = useState(SIMPLE_STREAMS_DEFAULT);
  const [protocol, setProtocol] = useState<"simplestreams" | "oci">("simplestreams");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("catalog");
    setType("container");
    setPicked(null);
    setAlias("");
    setServer(SIMPLE_STREAMS_DEFAULT);
    setProtocol("simplestreams");
  }, [open]);

  const source: { alias: string; server: string; protocol: "simplestreams" | "oci" } | null =
    mode === "catalog"
      ? picked
        ? { alias: picked.alias, server: picked.server, protocol: picked.protocol }
        : null
      : alias.trim() && server.trim()
        ? { alias: alias.trim(), server: server.trim(), protocol }
        : null;

  const pull = async () => {
    if (!source) return;
    setBusy(true);
    try {
      await infraApi.pullImage(source);
      toast("success", `Pulling ${source.alias}`);
      onPulled();
      onClose();
    } catch (err) {
      toast("danger", err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  };

  const modeButton = (key: Mode, label: string) => (
    <button
      type="button"
      data-testid={`pull-mode-${key}`}
      aria-pressed={mode === key}
      onClick={() => setMode(key)}
      className={`border-b-2 px-3 py-2 text-sm ${mode === key ? "border-accent-500 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"}`}
    >
      {label}
    </button>
  );

  const steps: Step[] = [
    {
      key: "image",
      title: "Choose image",
      invalid: source ? null : mode === "catalog" ? "Pick an image from the list (use the search box to filter)" : "Enter an alias and a server",
      content: (
        <div className="space-y-3">
          <div className="flex gap-1 border-b border-border">
            {modeButton("catalog", "Search catalog")}
            {modeButton("manual", "Enter manually")}
          </div>
          {mode === "catalog" ? (
            <div className="space-y-3">
              <Select label="Type" name="pull-type" data-testid="pull-type" value={type} onChange={(e) => setType(e.target.value as "container" | "virtual-machine")}>
                <option value="container">Container</option>
                <option value="virtual-machine">Virtual machine</option>
              </Select>
              <ImagePicker type={type} cloudInitEnabled={false} allowPull={false} onSelect={setPicked} />
            </div>
          ) : (
            <div className="space-y-3">
              <Input label="Alias" name="pull-alias" data-testid="pull-alias" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="ubuntu/24.04" />
              <Input label="Server" name="pull-server" data-testid="pull-server" value={server} onChange={(e) => setServer(e.target.value)} />
              <Select label="Protocol" name="pull-protocol" data-testid="pull-protocol" value={protocol} onChange={(e) => setProtocol(e.target.value as "simplestreams" | "oci")}>
                <option value="simplestreams">simplestreams</option>
                <option value="oci">oci</option>
              </Select>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "review",
      title: "Review",
      content: (
        <ReviewList
          rows={[
            { label: "Image", value: source?.alias ?? "—" },
            { label: "Server", value: source?.server ?? "—" },
            { label: "Protocol", value: source?.protocol ?? "—" },
          ]}
        />
      ),
    },
  ];

  return (
    <StepDialog
      open={open}
      onClose={onClose}
      title="Pull image"
      steps={steps}
      busy={busy}
      wide
      submitLabel="Pull"
      submitIcon={<Download size={14} />}
      onSubmit={pull}
    />
  );
}
