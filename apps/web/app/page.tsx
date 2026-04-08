import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";

type School = {
  id: string;
  code: string;
  name: string;
  default_locale: string;
  currency_code: string;
  country_code: string;
};

type Student = {
  id: string;
};

type OverdueInvoice = {
  id: string;
};

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

export default async function DashboardPage() {
  let schools: School[] = [];
  let students: Student[] = [];
  let overdue: OverdueInvoice[] = [];
  let apiError: string | null = null;

  try {
    schools = await apiGet<School[]>("/schools");
    students = await apiGet<Student[]>(
      `/students?schoolId=${SCHOOL_ID}`,
    );
    overdue = await apiGet<OverdueInvoice[]>(
      `/finance/overdue?schoolId=${SCHOOL_ID}`,
    );
  } catch (error) {
    apiError =
      error instanceof Error ? error.message : "Unknown API error";
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-slate-600">
            Operational overview for the school platform.
          </p>
        </div>

        {apiError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {apiError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Schools</div>
            <div className="mt-2 text-3xl font-bold">{schools.length}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Students</div>
            <div className="mt-2 text-3xl font-bold">{students.length}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Overdue Invoices</div>
            <div className="mt-2 text-3xl font-bold">{overdue.length}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">School Context</h2>
          <div className="mt-4 grid gap-3">
            {schools.map((school) => (
              <div
                key={school.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">{school.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Code: {school.code} · Locale: {school.default_locale} ·
                  Currency: {school.currency_code} · Country:{" "}
                  {school.country_code}
                </div>
              </div>
            ))}

            {schools.length === 0 && !apiError ? (
              <div className="text-sm text-slate-500">
                No schools found.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}