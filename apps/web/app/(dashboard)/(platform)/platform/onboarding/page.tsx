
import { getServerPlatformCopy } from "@/lib/i18n";
import { PlatformOnboardingClient } from "@/components/platform-onboarding-client";
import { PlatformPageHeader } from "@/components/platform-ui";

export default async function PlatformOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    managementMode?: string;
    attentionOnly?: string;
    search?: string;
  }>;
}) {
  const pt = await getServerPlatformCopy();

  const params = await searchParams;

  return (
      <div className="space-y-6">
        <PlatformPageHeader
          title={pt("Onboarding")}
          description={pt("Track setup progress and identify schools needing intervention.")}
        />
        <PlatformOnboardingClient
          initialStatus={params.status ?? ""}
          initialManagementMode={params.managementMode ?? ""}
          initialAttentionOnly={params.attentionOnly === "true"}
          initialSearch={params.search ?? ""}
        />
      </div>
  );
}
