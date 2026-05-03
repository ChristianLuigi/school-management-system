import { PlatformPageShell } from "@/components/platform-page-shell";
import { PlatformSchoolsClient } from "@/components/platform-schools-client";
import {
  PlatformPageHeader,
  PlatformPrimaryLinkButton,
} from "@/components/platform-ui";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  management_mode: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
  default_locale: string;
  timezone: string;
  currency_code: string;
  country_code: string;
};

export default async function PlatformSchoolsPage() {
  const schools = await serverApiGet<School[]>("/platform/schools");

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <PlatformPageHeader
          title="Schools"
          description="Manage school tenants across the platform."
          action={
            <PlatformPrimaryLinkButton href="/platform/schools/new">
              Create School
            </PlatformPrimaryLinkButton>
          }
        />
        <PlatformSchoolsClient initialSchools={schools} />
      </div>
    </PlatformPageShell>
  );
}
