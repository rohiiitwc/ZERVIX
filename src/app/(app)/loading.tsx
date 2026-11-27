export default function AppSectionLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading section">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-[var(--bg-card)]/70" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]" />
        <div className="h-72 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)]" />
      </div>
    </div>
  );
}
