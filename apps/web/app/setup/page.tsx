import { SchoolPageShell } from "@/components/school-page-shell";
import { SetupPageClient } from "@/components/setup-page-client";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

export default async function SetupPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <SetupPageClient schoolId={schoolId} />
    </SchoolPageShell>
  );
}
