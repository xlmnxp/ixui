export interface CardProps {
  title: string;
  value: string;
  sub?: string;
}

export function Card({ title, value, sub }: CardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface-900 p-4" data-testid="card">
      <div className="text-xs text-text-secondary">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="mt-1 text-xs text-text-tertiary">{sub}</div>}
    </div>
  );
}
