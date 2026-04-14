import Link from "next/link";
import { PlatformPageShell } from "@/components/platform-page-shell";
import { getMeContext } from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  default_locale: string;
  currency_code: string;
  country_code: string;
};

export default async function PlatformDashboardPage() {
  const context = await getMeContext();
  const schools = await serverApiGet<School[]>("/platform/schools");

  const activeCount = schools.filter((s) => s.status === "ACTIVE").length;
  const setupCount = schools.filter((s) => s.status === "ACTIVE_SETUP").length;
  const suspendedCount = schools.filter((s) => s.status === "SUSPENDED").length;

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Platform Dashboard</h1>
            <p className="mt-1 text-slate-600">
              Super admin view across all school tenants.
            </p>
          </div>

          <Link
            href="/platform/schools/new"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create School
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm text-slate-500">Logged-in User</div>
          <div className="mt-2 text-xl font-bold">
            {context.user.firstName ?? ""} {context.user.lastName ?? ""}
          </div>
          <div className="mt-1 text-sm text-slate-600">{context.user.email}</div>
          <div className="mt-1 text-sm text-slate-700">
            Platform role: {context.user.platformRole ?? "-"}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Total Schools</div>
            <div className="mt-2 text-3xl font-bold">{schools.length}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Active</div>
            <div className="mt-2 text-3xl font-bold">{activeCount}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">In Setup</div>
            <div className="mt-2 text-3xl font-bold">{setupCount}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Suspended</div>
            <div className="mt-2 text-3xl font-bold">{suspendedCount}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Schools</h2>
            <Link
              href="/platform/schools"
              className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {schools.slice(0, 5).map((school) => (
              <div
                key={school.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="font-semibold">{school.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Code: {school.code} · Status: {school.status} · Locale:{" "}
                  {school.default_locale} · Currency: {school.currency_code}
                </div>
              </div>
            ))}

            {schools.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">
                No schools yet.{" "}
                <Link
                  href="/platform/schools/new"
                  className="font-medium text-slate-900 underline underline-offset-2"
                >
                  Create the first one.
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PlatformPageShell>
  );
}
