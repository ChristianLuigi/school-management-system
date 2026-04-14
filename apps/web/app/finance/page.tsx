import Link from "next/link";
import { SchoolPageShell } from "@/components/school-page-shell";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type OverdueInvoice = {
  id: string;
  invoice_number: string;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  balance_due: string;
  due_date: string;
};

export default async function FinancePage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  const overdue = await serverApiGet<OverdueInvoice[]>(
    `/finance/overdue?schoolId=${schoolId}`,
  );

  return (
    <SchoolPageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="mt-1 text-slate-600">
            Invoice and overdue balance overview.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/finance/actions"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open Finance Actions
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm text-slate-500">Overdue Invoices</div>
          <div className="mt-2 text-3xl font-bold">{overdue.length}</div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Overdue List</h2>
          <div className="mt-4 space-y-3">
            {overdue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <div className="font-semibold">
                  {item.invoice_number} · {item.student_first_name}{" "}
                  {item.student_last_name}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  Student #: {item.student_number} · Balance: {item.balance_due}{" "}
                  · Due: {item.due_date}
                </div>
              </div>
            ))}
            {overdue.length === 0 ? (
              <div className="text-sm text-slate-500">No overdue invoices.</div>
            ) : null}
          </div>
        </div>
      </div>
    </SchoolPageShell>
  );
}
