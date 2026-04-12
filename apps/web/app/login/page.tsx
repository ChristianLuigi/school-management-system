"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_LOGIN_EMAIL ?? "admin@local.test";

const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_ADMIN_LOGIN_PASSWORD ?? "admin123";

const AUTH_COOKIE_NAME =
  process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? "school_admin_session";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function setSessionCookie() {
    document.cookie = `${AUTH_COOKIE_NAME}=authenticated; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (email.trim() !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
        throw new Error("Invalid credentials.");
      }

      setSessionCookie();

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6">
          <div className="text-sm uppercase tracking-wider text-slate-500">
            School Management System
          </div>
          <h1 className="mt-2 text-3xl font-bold">Admin Login</h1>
          <p className="mt-2 text-sm text-slate-600">
            Starter authentication for the internal admin workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}