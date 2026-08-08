import { Dialog } from "./dialog";
import { Button } from "./button";
import type { ButtonVariant } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: ButtonVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} data-testid="confirm-cancel">Cancel</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} data-testid="confirm-confirm">{confirmLabel}</Button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}
