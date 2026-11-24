export function RoutePending({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3 py-2" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="h-2 w-40 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
      <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
    </div>
  );
}
