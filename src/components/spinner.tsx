export interface SpinnerProps {
  size?: "xs" | "sm" | "md";
}

const sizes = { xs: "h-3.5 w-3.5 border-2", sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2" };

export function Spinner({ size = "sm" }: SpinnerProps) {
  return (
    <span
      data-testid="spinner"
      className={`inline-block animate-spin rounded-full border-solid border-transparent border-t-current ${sizes[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
}
