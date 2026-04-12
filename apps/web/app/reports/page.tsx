import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";

export default function ReportsPage() {
  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="mt-1 text-slate-600">
            Academic and finance reporting workspace.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/reports/report-cards"
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            <div className="text-lg font-semibold">Report Card Preview</div>
            <p className="mt-2 text-sm text-slate-600">
              Preview weighted trimester results and readiness before publishing.
            </p>
          </Link>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-semibold">Finance Reports</div>
            <p className="mt-2 text-sm text-slate-600">
              Coming next: overdue balances, payment trends, and invoice summaries.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}