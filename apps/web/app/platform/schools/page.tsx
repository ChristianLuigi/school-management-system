import { PlatformShell } from "@/components/platform-shell";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  default_locale: string;
  timezone: string;
  currency_code: string;
  country_code: string;
};

export default async function PlatformSchoolsPage() {
  const schools = await serverApiGet<School[]>("/platform/schools");

  return (
    <PlatformShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Schools</h1>
          <p className="mt-1 text-slate-600">
            Tenant list across the platform.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Locale</th>
                <th className="px-4 py-3">Timezone</th>
                <th className="px-4 py-3">Currency</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">{school.code}</td>
                  <td className="px-4 py-3">{school.name}</td>
                  <td className="px-4 py-3">{school.status}</td>
                  <td className="px-4 py-3">{school.default_locale}</td>
                  <td className="px-4 py-3">{school.timezone}</td>
                  <td className="px-4 py-3">{school.currency_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PlatformShell>
  );
}