import { PlatformPageShell } from "@/components/platform-page-shell";
import { PlatformInvitationsClient } from "@/components/platform-invitations-client";
import { serverApiGet } from "@/lib/server-api";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
};

export default async function PlatformInvitationsPage() {
  const schools = await serverApiGet<School[]>("/platform/schools");

  return (
    <PlatformPageShell>
      <PlatformInvitationsClient initialSchools={schools} />
    </PlatformPageShell>
  );
}
