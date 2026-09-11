export default function FinanceLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-label="Loading finance">
      <div className="h-11 rounded-2xl bg-slate-100" />
      <div className="space-y-2">
        <div className="h-8 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-100" />
        <div className="h-72 rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
