"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  ok: boolean;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    platformRole: "SUPER_ADMIN" | null;
  };
  schools: Array<{
    school_id: string;
    school_name: string;
    school_code: string;
    membership_id: string;
    membership_status: string;
    roles: string[];
  }>;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("superadmin@almac.local");
  const [password, setPassword] = useState("SuperAdmin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/session/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse | { message?: string } = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          "message" in data && data.message ? data.message : "Login failed.",
        );
      }

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
          <h1 className="mt-2 text-3xl font-bold">Internal Staff Login</h1>
          <p className="mt-2 text-sm text-slate-600">
            Login with a real backend account and school-aware session.
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