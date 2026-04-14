"use client";

import { FormEvent, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type InviteDetails = {
  invitationId: string;
  school: { id: string; code: string; name: string };
  invitedUser: { email: string; firstName: string | null; lastName: string | null };
  role: string;
  expiresAt: string;
  status: string;
};

type InviteAcceptClientProps = {
  token: string;
  invitation: InviteDetails;
};

export function InviteAcceptClient({ token, invitation }: InviteAcceptClientProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/school-invitations/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to accept invitation.");
      }

      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (accepted) {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-semibold">Account created!</h2>
        <p className="text-slate-600">
          You can now{" "}
          <a href="/login" className="font-medium text-slate-900 underline underline-offset-2">
            log in
          </a>{" "}
          with{" "}
          <span className="font-medium">{invitation.invitedUser.email}</span> and
          your new password.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-3">
        <h2 className="text-lg font-semibold">Invitation Details</h2>
        <div className="grid gap-1 text-sm text-slate-700">
          <div>
            <span className="font-medium">School:</span>{" "}
            {invitation.school.name} ({invitation.school.code})
          </div>
          <div>
            <span className="font-medium">Email:</span>{" "}
            {invitation.invitedUser.email}
          </div>
          {(invitation.invitedUser.firstName || invitation.invitedUser.lastName) ? (
            <div>
              <span className="font-medium">Name:</span>{" "}
              {[invitation.invitedUser.firstName, invitation.invitedUser.lastName]
                .filter(Boolean)
                .join(" ")}
            </div>
          ) : null}
          <div>
            <span className="font-medium">Role:</span> {invitation.role}
          </div>
          <div>
            <span className="font-medium">Expires:</span>{" "}
            {new Date(invitation.expiresAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4"
      >
        <h2 className="text-lg font-semibold">Set Your Password</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Confirm Password
          </label>
          <input
            type="password"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Repeat your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Accept Invitation"}
        </button>
      </form>
    </div>
  );
}
