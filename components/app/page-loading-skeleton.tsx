export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden>
      <div className="space-y-3">
        <div className="h-4 w-28 rounded-full bg-elevated" />
        <div className="h-10 w-64 max-w-full rounded-xl bg-elevated" />
        <div className="h-4 w-full max-w-xl rounded-lg bg-elevated/80" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-2xl border border-border bg-surface" />
        <div className="h-28 rounded-2xl border border-border bg-surface" />
        <div className="h-28 rounded-2xl border border-border bg-surface" />
      </div>
      <div className="h-64 rounded-3xl border border-border bg-surface" />
    </div>
  );
}
