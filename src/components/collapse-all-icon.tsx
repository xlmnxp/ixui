export interface CollapseAllIconProps {
  size?: number;
  className?: string;
}

/**
 * Collapse-all glyph matching VS Code's codicon: a rounded square with a rule
 * near the top and a chevron pointing up at it. Inherits the text colour.
 */
export function CollapseAllIcon({ size = 13, className = "" }: CollapseAllIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
      data-testid="collapse-all-icon"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4.6 5.4h6.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path
        d="M5.6 10.4 8 8l2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
