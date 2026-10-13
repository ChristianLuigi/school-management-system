"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, GraduationCap } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";

export function LoginClient() {
  const router = useRouter();
  const { t } = useI18n();
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const activated = searchParams.get("activated") === "1";
  const membershipAdded = searchParams.get("membershipAdded") === "1";
  const passwordReset = searchParams.get("passwordReset") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? "login.invalid" : "login.unavailable");
        return;
      }

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
    } catch {
      setError("login.unavailable");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (searchParams.get("acceptInvitation") === "1" &&
        !window.sessionStorage.getItem("almac_pending_invitation")) {
      setError("login.invitationMissing");
    }
  }, [searchParams]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 sm:p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-foreground shadow-md sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold"><GraduationCap size={24} aria-hidden="true" />ALMAC</div>
          <LanguageSwitcher />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t("login.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("login.description")}</p>
        {activated && <Notice>{t("login.activated")}</Notice>}
        {membershipAdded && <Notice>{t("login.membershipAdded")}</Notice>}
        {passwordReset && <Notice>{t("login.reset")}</Notice>}
        {error && <div role="alert" id="login-error" className="mt-5 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">{t(error)}</div>}
        <label className="mt-6 block text-sm">
          <span className="font-medium">{t("login.email")}</span>
          <input required type="email" autoComplete="username" inputMode="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-3 text-foreground" />
        </label>
        <label className="mt-4 block text-sm">
          <span className="font-medium">{t("login.password")}</span>
          <span className="relative mt-2 block">
          <input required type={showPassword ? "text" : "password"} autoComplete="current-password" maxLength={128} value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-input bg-surface py-3 pl-3 pr-12 text-foreground" />
          <button type="button" aria-label={t(showPassword ? "login.hidePassword" : "login.showPassword")} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1 rounded-md p-3 text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
          </span>
        </label>
        <button type="submit" disabled={submitting}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          {t(submitting ? "login.submitting" : "login.submit")}
        </button>
        <a href="/forgot-password" className="mt-5 block text-center text-sm text-foreground underline underline-offset-4">{t("login.forgot")}</a>
      </form>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div role="status" className="mt-5 rounded-xl border border-success/40 bg-success-subtle p-3 text-sm text-success">{children}</div>;
}
