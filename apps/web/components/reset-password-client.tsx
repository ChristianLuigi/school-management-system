"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

type ResetInformation = {
  valid: boolean;
  emailMasked: string;
  expiresAt: string;
};

export function ResetPasswordClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [token, setToken] = useState("");
  const [information, setInformation] = useState<ResetInformation | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function inspect(rawToken: string) {
    try {
      const response = await fetch("/api/auth/password-reset/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(t("auth.resetPassword.invalidMessage"));
      setInformation(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("auth.resetPassword.invalidMessage"),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const rawToken = params.get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!rawToken) {
      setError(t("auth.resetPassword.invalidMessage"));
      setLoading(false);
      return;
    }
    setToken(rawToken);
    void inspect(rawToken);
    // The token must be captured and removed exactly once on initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== passwordConfirmation) {
      setError(t("auth.resetPassword.mismatch"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirmation }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          body?.message ?? t("auth.resetPassword.invalidMessage"),
        );
      router.replace(body.redirectTo ?? "/login?passwordReset=1");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("auth.resetPassword.invalidMessage"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        {t("auth.resetPassword.checking")}
      </main>
    );
  if (!information)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8">
          <h1 className="text-xl font-bold">
            {t("auth.resetPassword.invalidTitle")}
          </h1>
          <p className="mt-3 text-sm text-red-700">{error}</p>
          <a
            href="/forgot-password"
            className="mt-6 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm text-white"
          >
            {t("auth.forgotPassword.title")}
          </a>
        </div>
      </main>
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-3xl font-bold text-slate-950">
          {t("auth.resetPassword.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {t("auth.resetPassword.account")}: {information.emailMasked}
        </p>
        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <label className="mt-6 block text-sm">
          <span className="font-medium">
            {t("auth.resetPassword.password")}
          </span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-slate-500">
            {t("auth.resetPassword.passwordHint")}
          </span>
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">
            {t("auth.resetPassword.confirmPassword")}
          </span>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={15}
            maxLength={128}
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting
            ? t("auth.resetPassword.submitting")
            : t("auth.resetPassword.submit")}
        </button>
      </form>
    </main>
  );
}
