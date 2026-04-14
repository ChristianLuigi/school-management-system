import { PlatformPageShell } from "@/components/platform-page-shell";
import { PlatformCreateSchoolPageClient } from "@/components/platform-create-school-page-client";

export default function PlatformCreateSchoolPage() {
  return (
    <PlatformPageShell>
      <PlatformCreateSchoolPageClient />
    </PlatformPageShell>
  );
}
