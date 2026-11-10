import { PackagePlus } from "lucide-react";

export interface CreateInstanceIconProps {
  size?: number;
  className?: string;
}

/**
 * The single icon for every "create instance" affordance in the app: the
 * explorer bar, per-member tree actions, page actions and the command palette.
 * Change it here and every entry point follows.
 */
export function CreateInstanceIcon({ size = 14, className }: CreateInstanceIconProps) {
  return <PackagePlus size={size} className={className} data-testid="create-instance-icon" />;
}
