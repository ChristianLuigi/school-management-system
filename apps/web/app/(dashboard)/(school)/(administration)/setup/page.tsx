import { SetupPageClient } from "@/components/setup-page-client";
import { SchoolBrandingClient } from "@/components/school-branding-client";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function SetupPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  return (
    <div className="space-y-6">
      <SchoolBrandingClient schoolId={schoolId} />
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-medium">Configuration scolaire / School setup</summary>
        <div className="mt-4"><SetupPageClient schoolId={schoolId} /></div>
      </details>
    </div>
  );
}
