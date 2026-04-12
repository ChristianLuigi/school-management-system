import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";
import Link from "next/link";

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total_amount: string;
  balance_due: string;
  due_date: string;
};

type OverdueInvoice = {
  id: string;
  invoice_number: string;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
  balance_due: string;
  due_date: string;
};

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";
const STUDENT_ID = "7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

export default async function FinancePage() {
  const [invoices, overdue] = await Promise.all([
    apiGet<Invoice[]>(`/invoices?studentId=${STUDENT_ID}`),
    apiGet<OverdueInvoice[]>(`/finance/overdue?schoolId=${SCHOOL_ID}`),
  ]);

  return (
    <AdminShell>
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
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Invoices</div>
            <div className="mt-2 text-3xl font-bold">{invoices.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Overdue Invoices</div>
            <div className="mt-2 text-3xl font-bold">{overdue.length}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Student Invoices</h2>
          <div className="mt-4 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">{invoice.invoice_number}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Status: {invoice.status} · Total: {invoice.total_amount} ·
                  Balance: {invoice.balance_due} · Due: {invoice.due_date}
                </div>
              </div>
            ))}
            {invoices.length === 0 ? (
              <div className="text-sm text-slate-500">
                No invoices found.
              </div>
            ) : null}
          </div>
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
                  Student #: {item.student_number} · Balance:{" "}
                  {item.balance_due} · Due: {item.due_date}
                </div>
              </div>
            ))}
            {overdue.length === 0 ? (
              <div className="text-sm text-slate-500">
                No overdue invoices.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}