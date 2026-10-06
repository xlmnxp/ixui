import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Save, X } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface Step {
  key: string;
  title: string;
  content: ReactNode;
  /** Return a message when the step can't be left yet; omit or return null/true when it's fine. */
  invalid?: string | null;
}

export interface StepDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: Step[];
  onSubmit: () => void;
  submitLabel?: string;
  submitIcon?: ReactNode;
  busy?: boolean;
  wide?: boolean;
  /** Edit flows let people jump straight to any step; create flows must go in order. */
  freeNavigation?: boolean;
}

export function StepDialog({
  open,
  onClose,
  title,
  steps,
  onSubmit,
  submitLabel = "Save",
  submitIcon = <Save size={14} />,
  busy = false,
  wide = false,
  freeNavigation = false,
}: StepDialogProps) {
  const [index, setIndex] = useState(0);
  const [furthest, setFurthest] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setFurthest(0);
    }
  }, [open]);

  const step = steps[Math.min(index, steps.length - 1)]!;
  const last = index >= steps.length - 1;
  const firstInvalid = steps.findIndex((s) => s.invalid);

  const goTo = (i: number) => {
    setIndex(i);
    setFurthest((f) => Math.max(f, i));
  };

  const canVisit = (i: number): boolean => {
    if (i <= index) return true;
    // Moving forward is allowed only if every step before the target is valid.
    const blocked = steps.slice(0, i).some((s) => s.invalid);
    return !blocked && (freeNavigation || i <= furthest + 1);
  };

  const submitBlocked = firstInvalid !== -1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="step-cancel"><X size={14} /> Cancel</Button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button variant="secondary" onClick={() => goTo(index - 1)} data-testid="step-back"><ArrowLeft size={14} /> Back</Button>
            )}
            {last ? (
              <Button onClick={onSubmit} loading={busy} disabled={submitBlocked} data-testid="step-submit">{submitIcon} {submitLabel}</Button>
            ) : (
              <Button onClick={() => goTo(index + 1)} disabled={Boolean(step.invalid)} data-testid="step-next">Next <ArrowRight size={14} /></Button>
            )}
          </div>
        </div>
      }
    >
      <ol className="mb-4 flex items-center gap-1 text-xs" aria-label="Steps" data-testid="stepper">
        {steps.map((s, i) => {
          // Progress ticks only make sense when creating; when editing, every step already has a value.
          const done = !freeNavigation && (i < index || (i <= furthest && i !== index && !s.invalid));
          const current = i === index;
          const enabled = canVisit(i);
          return (
            <li key={s.key} className="flex items-center gap-1" aria-current={current ? "step" : undefined}>
              {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
              <button
                type="button"
                data-testid={`step-tab-${s.key}`}
                disabled={!enabled}
                onClick={() => goTo(i)}
                className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${current ? "text-text-primary" : "text-text-secondary"} ${enabled && !current ? "hover:bg-surface-700" : ""} disabled:opacity-50`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                    current ? "border-accent-500 bg-accent-600 text-white" : done ? "border-success bg-success/20 text-success" : "border-border text-text-tertiary"
                  }`}
                >
                  {done && !current ? <Check size={11} /> : i + 1}
                </span>
                {s.invalid && freeNavigation && !current && <span className="h-1.5 w-1.5 rounded-full bg-red-400" role="img" aria-label="Needs attention" />}
                <span className={current ? "font-medium" : ""}>{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div data-testid={`step-content-${step.key}`}>{step.content}</div>
      {step.invalid && (
        <p role="alert" className="mt-3 text-xs text-text-tertiary" data-testid="step-hint">{step.invalid}</p>
      )}
      {last && submitBlocked && (
        <p role="alert" className="mt-3 text-xs text-red-300" data-testid="step-blocked">
          Finish “{steps[firstInvalid]!.title}” first: {steps[firstInvalid]!.invalid}
        </p>
      )}
    </Dialog>
  );
}

/** Read-only summary rows for a Review step. */
export function ReviewList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border rounded border border-border text-sm" data-testid="review-list">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-3 px-3 py-1.5">
          <dt className="w-32 shrink-0 text-text-secondary">{r.label}</dt>
          <dd className="min-w-0 flex-1 break-words text-text-primary">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
