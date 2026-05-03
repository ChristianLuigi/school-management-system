import { PlatformPageShell } from "@/components/platform-page-shell";
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
  const params = await searchParams;

  return (
    <PlatformPageShell>
      <div className="space-y-6">
        <PlatformPageHeader
          title="Onboarding"
          description="Track setup progress and identify schools needing intervention."
        />
        <PlatformOnboardingClient
          initialStatus={params.status ?? ""}
          initialManagementMode={params.managementMode ?? ""}
          initialAttentionOnly={params.attentionOnly === "true"}
          initialSearch={params.search ?? ""}
        />
      </div>
    </PlatformPageShell>
  );
}
