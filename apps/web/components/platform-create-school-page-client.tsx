"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type CreateSchoolResponse = {
  school: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  levels: Array<{
    id: string;
    code: string;
    name_i18n: Record<string, string>;
  }>;
  firstAdminInvitation: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    invited_role: string;
    invitation_status: string;
    expires_at: string;
    devToken: string;
  };
};

export function PlatformCreateSchoolPageClient() {
  const [form, setForm] = useState({
    code: "",
    name: "",
    defaultLocale: "fr",
    timezone: "America/Port-au-Prince",
    currencyCode: "HTG",
    countryCode: "HT",
    includeKG: false,
    includePRIM: true,
    includeSEC: true,
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreateSchoolResponse | null>(null);

  function buildInitialLevels() {
    const levels: Array<"KG" | "PRIM" | "SEC"> = [];
    if (form.includeKG) levels.push("KG");
    if (form.includePRIM) levels.push("PRIM");
    if (form.includeSEC) levels.push("SEC");
    return levels;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const initialLevels = buildInitialLevels();

      if (initialLevels.length === 0) {
        throw new Error("Select at least one school level.");
      }

      const res = await fetch(`${API_BASE_URL}/platform/schools`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          defaultLocale: form.defaultLocale,
          timezone: form.timezone.trim(),
          currencyCode: form.currencyCode.trim().toUpperCase(),
          countryCode: form.countryCode.trim().toUpperCase(),
          initialLevels,
          firstAdmin: {
            email: form.adminEmail.trim().toLowerCase(),
            firstName: form.adminFirstName.trim(),
            lastName: form.adminLastName.trim(),
          },
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to create school.");
      }

      setResult(data);
      setForm({
        code: "",
        name: "",
        defaultLocale: "fr",
        timezone: "America/Port-au-Prince",
        currencyCode: "HTG",
        countryCode: "HT",
        includeKG: false,
        includePRIM: true,
        includeSEC: true,
        adminEmail: "",
        adminFirstName: "",
        adminLastName: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create school.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Create School</h1>
          <p className="mt-1 text-slate-600">
            Create a new tenant and generate the first school admin invitation.
          </p>
        </div>

        <Link
          href="/platform/schools"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50"
        >
          Back to Schools
        </Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div>
            <div className="text-sm text-green-700">School created successfully</div>
            <div className="mt-1 text-xl font-bold text-green-900">
              {result.school.name} ({result.school.code})
            </div>
            <div className="mt-1 text-sm text-green-800">
              Status: {result.school.status}
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 ring-1 ring-green-200">
            <div className="text-sm font-medium text-slate-700">
              First Admin Invitation
            </div>
            <div className="mt-2 text-sm text-slate-700">
              {result.firstAdminInvitation.first_name}{" "}
              {result.firstAdminInvitation.last_name} &middot;{" "}
              {result.firstAdminInvitation.email}
            </div>
            <div className="mt-1 text-sm text-slate-700">
              Role: {result.firstAdminInvitation.invited_role}
            </div>
            <div className="mt-3 rounded-lg bg-slate-100 p-3">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Dev Token
              </div>
              <div className="mt-1 break-all font-mono text-sm text-slate-900">
                {result.firstAdminInvitation.devToken}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Save this token now. It is used to resolve and accept the invitation.
            </div>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">School Details</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">School Code</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="BETA-SCHOOL"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">School Name</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Beta International School"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Default Locale
                </label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.defaultLocale}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultLocale: e.target.value,
                    }))
                  }
                >
                  <option value="fr">fr</option>
                  <option value="en">en</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Timezone</label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.timezone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Currency Code
                </label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.currencyCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      currencyCode: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Country Code
                </label>
                <input
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.countryCode}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      countryCode: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <div className="mb-2 block text-sm font-medium">Initial Levels</div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.includeKG}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        includeKG: e.target.checked,
                      }))
                    }
                  />
                  Kindergarten
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.includePRIM}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        includePRIM: e.target.checked,
                      }))
                    }
                  />
                  Primary
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.includeSEC}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        includeSEC: e.target.checked,
                      }))
                    }
                  />
                  Secondary
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">First School Admin</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="director.beta@school.local"
                value={form.adminEmail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">First Name</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Marie"
                value={form.adminFirstName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    adminFirstName: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Last Name</label>
              <input
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Pierre"
                value={form.adminLastName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    adminLastName: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Creating School..." : "Create School"}
        </button>
      </form>
    </div>
  );
}
