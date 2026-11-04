"use client";


import { platformErrorKey } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import Link from "next/link";
import { FormEvent, useState } from "react";

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
  firstAdmin: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeCreateSchoolResponse(
  payload: unknown,
  tempPassword: string,
): (CreateSchoolResponse & { tempPassword: string }) | null {
  if (!isRecord(payload)) {
    return null;
  }

  const schoolSource = isRecord(payload.school) ? payload.school : payload;

  const school = {
    id: toStringValue(schoolSource.id),
    code: toStringValue(schoolSource.code),
    name: toStringValue(schoolSource.name),
    status: toStringValue(schoolSource.status),
  };

  if (!school.id || !school.code || !school.name || !school.status) {
    return null;
  }

  const rawLevels = Array.isArray(payload.levels) ? payload.levels : [];
  const levels = rawLevels
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        id: toStringValue(item.id),
        code: toStringValue(item.code),
        name_i18n: isRecord(item.name_i18n)
          ? (item.name_i18n as Record<string, string>)
          : {},
      };
    })
    .filter((item): item is CreateSchoolResponse["levels"][number] =>
      Boolean(item && item.id && item.code),
    );

  const firstAdminSource = isRecord(payload.firstAdmin)
    ? payload.firstAdmin
    : isRecord(payload.firstAdminInvitation)
      ? payload.firstAdminInvitation
      : null;

  if (!firstAdminSource) {
    return null;
  }

  const firstAdmin = {
    id: toStringValue(firstAdminSource.id),
    email: toStringValue(firstAdminSource.email),
    first_name: toNullableString(firstAdminSource.first_name),
    last_name: toNullableString(firstAdminSource.last_name),
  };

  if (!firstAdmin.email) {
    return null;
  }

  return {
    school,
    levels,
    firstAdmin,
    tempPassword,
  };
}

export function PlatformCreateSchoolPageClient() {
  const pt = usePlatformCopy();

  const [form, setForm] = useState({
    name: "",
    defaultLocale: "fr",
    timezone: "America/Port-au-Prince",
    currencyCode: "HTG",
    countryCode: "HT",
    includeKG: false,
    includePRIM: true,
    includeSEC: true,
    adminEmail: "",
    adminPassword: "",
    adminFirstName: "",
    adminLastName: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<
    (CreateSchoolResponse & { tempPassword: string }) | null
  >(null);

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

      const res = await fetch(`/api/proxy/platform/schools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          defaultLocale: form.defaultLocale,
          timezone: form.timezone.trim(),
          currencyCode: form.currencyCode.trim().toUpperCase(),
          countryCode: form.countryCode.trim().toUpperCase(),
          initialLevels,
          firstAdmin: {
            email: form.adminEmail.trim().toLowerCase(),
            temporaryPassword: form.adminPassword,
            firstName: form.adminFirstName.trim() || undefined,
            lastName: form.adminLastName.trim() || undefined,
          },
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message ?? "Failed to create school.");
      }

      const normalizedResult = normalizeCreateSchoolResponse(data, form.adminPassword);

      if (!normalizedResult) {
        throw new Error("Unexpected response from school creation endpoint.");
      }

      setResult(normalizedResult);

      setForm((prev) => ({
        ...prev,
        name: "",
        adminEmail: "",
        adminPassword: "",
        adminFirstName: "",
        adminLastName: "",
      }));
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
          <h1 className="text-3xl font-bold">{pt("Create School")}</h1>
          <p className="mt-1 text-muted-foreground">{pt("Provision a new tenant and set the first admin's login credentials.")}{" "}</p>
        </div>

        <Link
          href="/platform/schools"
          className="rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-sm font-medium hover:bg-surface-muted"
        >{pt("Back to Schools")}{" "}</Link>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-danger">
          {pt(platformErrorKey(error))}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-4 rounded-2xl border border-success/40 bg-success-subtle p-5">
          <div>
            <div className="text-sm font-medium text-success">{pt("School created successfully")}{" "}</div>
            <div className="mt-1 text-xl font-bold text-success">
              {result.school.name}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <div className="rounded-lg bg-success-subtle px-3 py-1 font-mono font-semibold text-success">
                {result.school.code}
              </div>
              <div className="rounded-lg bg-success-subtle px-3 py-1 text-success">
                {result.school.status}
              </div>
              <div className="rounded-lg bg-success-subtle px-3 py-1 text-success">{pt("Levels:")}{" "}{result.levels.map((l) => l.code).join(", ")}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-surface text-foreground p-4 ring-1 ring-ring">
            <div className="text-sm font-semibold text-foreground">{pt("First Admin — Login Credentials")}{" "}</div>
            <p className="mt-1 text-xs text-muted-foreground">{pt("Share these with the school admin. They will use them to log in and complete onboarding.")}{" "}</p>

            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span className="text-muted-foreground">{pt("Email")}</span>
                <span className="font-mono font-medium">
                  {result.firstAdmin.email}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                <span className="text-muted-foreground">{pt("Temporary Password")}</span>
                <span className="font-mono font-medium">
                  {result.tempPassword}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs text-warning">{pt("This password is shown once. Copy it now before leaving this page.")}{" "}</p>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl bg-surface text-foreground p-6 shadow-sm ring-1 ring-border"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          {/* School details */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{pt("School Details")}</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("School Name")}{" "}</label>
              <input
                required
                className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
                placeholder={pt("Beta International School")}
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt("Default Locale")}{" "}</label>
                <select
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
                  value={form.defaultLocale}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      defaultLocale: e.target.value,
                    }))
                  }
                >
                  <option value="fr">{pt("fr")}</option>
                  <option value="en">{pt("en")}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">{pt("Timezone")}{" "}</label>
                <input
                  required
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
                  value={form.timezone}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt("Currency Code")}{" "}</label>
                <input
                  required
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
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
                <label className="mb-1 block text-sm font-medium">{pt("Country Code")}{" "}</label>
                <input
                  required
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
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
              <div className="mb-2 block text-sm font-medium">{pt("Initial Levels")}{" "}</div>
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
                  />{pt("Kindergarten")}{" "}</label>

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
                  />{pt("Primary")}{" "}</label>

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
                  />{pt("Secondary")}{" "}</label>
              </div>
            </div>
          </div>

          {/* First admin */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{pt("First School Admin")}</h2>
            <p className="text-sm text-muted-foreground">{pt("This person will receive the credentials below and log in to complete the school setup.")}{" "}</p>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Email")}</label>
              <input
                type="email"
                required
                className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
                placeholder="director@school.com"
                value={form.adminEmail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Temporary Password")}{" "}</label>
              <input
                type="text"
                required
                minLength={8}
                className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2 font-mono"
                placeholder={pt("At least 8 characters")}
                value={form.adminPassword}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    adminPassword: e.target.value,
                  }))
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">{pt("You set this. The admin uses it to log in for the first time.")}{" "}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">{pt("First Name")}{" "}
                  <span className="font-normal text-muted-foreground">{pt("(optional)")}</span>
                </label>
                <input
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
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
                <label className="mb-1 block text-sm font-medium">{pt("Last Name")}{" "}
                  <span className="font-normal text-muted-foreground">{pt("(optional)")}</span>
                </label>
                <input
                  className="w-full rounded-lg border border-input bg-surface text-foreground px-3 py-2"
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
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary px-5 py-3 text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {submitting ? pt("Creating School...") : pt("Create School")}
        </button>
      </form>
    </div>
  );
}
