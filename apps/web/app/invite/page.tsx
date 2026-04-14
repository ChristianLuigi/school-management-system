import { InviteAcceptClient } from "@/components/invite-accept-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type InviteDetails = {
  invitationId: string;
  school: { id: string; code: string; name: string };
  invitedUser: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  role: string;
  expiresAt: string;
  status: string;
};

async function resolveInvitation(
  token: string,
): Promise<InviteDetails | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/school-invitations/resolve?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );

    if (!res.ok) return null;

    return res.json();
  } catch {
    return null;
  }
}

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Accept Invitation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Set a password to activate your school account.
          </p>
        </div>

        {!token ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center text-slate-600">
            Invalid invitation link. No token provided.
          </div>
        ) : (
          <InviteContent token={token} />
        )}
      </div>
    </div>
  );
}

async function InviteContent({ token }: { token: string }) {
  const invitation = await resolveInvitation(token);

  if (!invitation) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center text-slate-600">
        This invitation link is invalid, expired, or has already been used.
      </div>
    );
  }

  if (invitation.status !== "PENDING") {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center text-slate-600">
        This invitation has already been{" "}
        <span className="font-medium">{invitation.status.toLowerCase()}</span>{" "}
        and cannot be accepted again.
      </div>
    );
  }

  return <InviteAcceptClient token={token} invitation={invitation} />;
}
