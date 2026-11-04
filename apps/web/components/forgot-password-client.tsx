"use client";

import { FormEvent, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function ForgotPasswordClient() {
  const { locale, t } = useI18n();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (!response.ok) throw new Error(t("auth.forgotPassword.requestFailed"));
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("auth.forgotPassword.requestFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-sm">
        <div className="text-sm font-semibold text-info">ALMAC School Management</div>
        {submitted ? <>
          <h1 className="mt-3 text-2xl font-bold text-foreground">{t("auth.forgotPassword.successTitle")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t("auth.forgotPassword.successMessage")}</p>
          <a href="/login" className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-solid-foreground">{t("auth.forgotPassword.backToLogin")}</a>
        </> : <form onSubmit={submit}>
          <h1 className="mt-3 text-3xl font-bold text-foreground">{t("auth.forgotPassword.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.forgotPassword.description")}</p>
          {error ? <div className="mt-5 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">{error}</div> : null}
          <label className="mt-6 block text-sm"><span className="font-medium">{t("auth.forgotPassword.email")}</span>
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-input px-3 py-2" />
          </label>
          <button type="submit" disabled={submitting} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {submitting ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
          </button>
          <a href="/login" className="mt-4 block text-center text-sm text-info hover:underline">{t("auth.forgotPassword.backToLogin")}</a>
        </form>}
      </div>
    </main>
  );
}