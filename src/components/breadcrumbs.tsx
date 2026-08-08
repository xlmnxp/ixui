import { Link } from "react-router-dom";

export interface Crumb {
  label: string;
  to?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav data-testid="breadcrumbs" className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-text-tertiary">/</span>}
          {c.to ? (
            <Link data-testid={`crumb-${c.label}`} to={c.to} className="text-accent-400 hover:underline">{c.label}</Link>
          ) : (
            <span className="text-text-secondary">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
