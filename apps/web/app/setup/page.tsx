import { SchoolPageShell } from "@/components/school-page-shell";
import { SetupPageClient } from "@/components/setup-page-client";

export default function SetupPage() {
  return (
    <SchoolPageShell allowedRoles={["SCHOOL_ADMIN"]}>
      <SetupPageClient />
    </SchoolPageShell>
  );
}