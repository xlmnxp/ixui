import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "./toast";
import { Tooltip } from "./tooltip";

export interface CopyButtonProps {
  value: string;
  /** What was copied, for the toast ("IP address", "Token", …). */
  label?: string;
  dataTestId?: string;
}

/** Small icon button that copies `value` and confirms with a tick. */
export function CopyButton({ value, label = "Value", dataTestId = "copy-button" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(true);
      toast("success", `${label} copied`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("danger", `Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <Tooltip label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}>
      <button
        type="button"
        data-testid={dataTestId}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={() => void copy()}
        className="rounded p-0.5 text-text-tertiary hover:bg-surface-700 hover:text-text-primary"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
    </Tooltip>
  );
}
