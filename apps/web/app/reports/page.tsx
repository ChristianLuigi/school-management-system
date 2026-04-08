import { AdminShell } from "@/components/admin-shell";

export default function ReportsPage() {
  return (
    <AdminShell>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-slate-600">
          This page will later host report card previews, finance reports,
          attendance summaries, and exports.
        </p>
      </div>
    </AdminShell>
  );
}