"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Invitation = {
  valid: boolean;
  schoolName: string;
  emailMasked: string;
  roleCode: string;
  locale: "fr" | "en";
  firstName: string | null;
  lastName: string | null;
  expiresAt: string;
  accountAlreadyExists: boolean;
};

export function ActivateAccountClient() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const rawToken = params.get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!rawToken) {
      setError("Le lien d’activation est invalide.");
      setLoading(false);
      return;
    }
    setToken(rawToken);
    void fetch("/api/auth/invitations/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawToken }),
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            body?.message ?? "Cette invitation est invalide ou expirée.",
          );
        setInvitation(body);
        setFirstName(body.firstName ?? "");
        setLastName(body.lastName ?? "");
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de vérifier l’invitation.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      if (password !== passwordConfirmation)
        throw new Error("Les mots de passe ne correspondent pas.");
      const response = await fetch("/api/auth/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          firstName,
          lastName,
          password,
          passwordConfirmation,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const payload = body?.response ?? body;
        if (payload?.code === "ACCOUNT_ALREADY_EXISTS") {
          window.sessionStorage.setItem("almac_pending_invitation", token);
          router.push("/login?acceptInvitation=1");
          return;
        }
        throw new Error(payload?.message ?? "Impossible d’activer le compte.");
      }
      router.replace(body.redirectTo ?? "/login?activated=1");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’activer le compte.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <Shell>
        <p>Vérification de l’invitation…</p>
      </Shell>
    );
  if (error && !invitation)
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Lien indisponible</h1>
        <p className="mt-3 text-sm text-red-700">{error}</p>
        <a
          href="/login"
          className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
        >
          Retour à la connexion
        </a>
      </Shell>
    );
  if (invitation?.accountAlreadyExists)
    return (
      <Shell>
        <h1 className="text-2xl font-bold">Compte existant</h1>
        <p className="mt-3 text-sm text-slate-600">
          Un compte existe déjà pour {invitation.emailMasked}. Connectez-vous
          pour rejoindre {invitation.schoolName}.
        </p>
        <button
          onClick={() => {
            window.sessionStorage.setItem("almac_pending_invitation", token);
            router.push("/login?acceptInvitation=1");
          }}
          className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Se connecter
        </button>
      </Shell>
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="text-sm font-medium text-blue-700">
          ALMAC School Management
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Activez votre compte
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Vous rejoignez <strong>{invitation?.schoolName}</strong> avec le rôle{" "}
          <strong>{invitation?.roleCode}</strong>.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Adresse vérifiée : {invitation?.emailMasked}
        </p>
        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Prénom"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
          />
          <Field
            label="Nom"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
          />
        </div>
        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={setPassword}
        />
        <p className="mt-1 text-xs text-slate-500">
          Utilisez au moins 15 caractères. Les espaces sont autorisés.
        </p>
        <PasswordField
          label="Confirmer le mot de passe"
          value={passwordConfirmation}
          onChange={setPasswordConfirmation}
        />
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Activation…" : "Activer mon compte"}
        </button>
      </form>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border bg-white p-8">{children}</div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="text-sm">
      <span className="font-medium">{label}</span>
      <input
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm">
      <span className="font-medium">{label}</span>
      <input
        required
        type="password"
        autoComplete="new-password"
        minLength={15}
        maxLength={128}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
