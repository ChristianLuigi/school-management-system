"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const activated = searchParams.get("activated") === "1";
  const membershipAdded = searchParams.get("membershipAdded") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message ?? "Adresse électronique ou mot de passe incorrect.");

      const invitationToken = window.sessionStorage.getItem("almac_pending_invitation");
      if (invitationToken) {
        const invitationResponse = await fetch("/api/auth/invitations/accept-existing", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: invitationToken }),
        });
        if (invitationResponse.ok) {
          window.sessionStorage.removeItem("almac_pending_invitation");
          window.location.assign("/login?membershipAdded=1");
          return;
        }
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("acceptInvitation") === "1" &&
        !window.sessionStorage.getItem("almac_pending_invitation")) {
      setError("Le lien d’invitation n’est plus disponible. Ouvrez à nouveau le courriel reçu.");
    }
  }, [searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold text-blue-700">ALMAC School Management</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Connexion</h1>
        <p className="mt-2 text-sm text-slate-600">Accédez à votre espace scolaire sécurisé.</p>
        {activated && <Notice>Votre compte a été activé. Vous pouvez maintenant vous connecter.</Notice>}
        {membershipAdded && <Notice>Votre nouvelle école a été ajoutée. Reconnectez-vous pour continuer.</Notice>}
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <label className="mt-6 block text-sm">
          <span className="font-medium">Adresse électronique</span>
          <input required type="email" autoComplete="username" inputMode="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Mot de passe</span>
          <input required type="password" autoComplete="current-password" maxLength={128} value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" disabled={submitting}
          className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{children}</div>;
}
