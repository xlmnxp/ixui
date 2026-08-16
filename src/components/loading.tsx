import { Spinner } from "./spinner";

export interface LoadingProps {
  label?: string;
  dataTestId?: string;
  /** Center the indicator vertically across the whole viewport (for pre-auth screens). */
  fullScreen?: boolean;
}

export function Loading({ label = "Loading…", dataTestId = "loading", fullScreen = false }: LoadingProps) {
  return (
    <div
      data-testid={dataTestId}
      role="status"
      aria-live="polite"
      className={`flex items-center justify-center gap-2 text-sm text-text-tertiary ${
        fullScreen ? "min-h-screen" : "p-6"
      }`}
    >
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}
