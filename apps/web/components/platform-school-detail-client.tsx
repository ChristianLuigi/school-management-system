"use client";


import { platformErrorKey } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ManagementModeBadge,
  PlatformBadge,
  PlatformPanel,
  PlatformStatCard,
  StatusBadge,
} from "@/components/platform-ui";

type SchoolDetail = {
  school: {
    id: string;
    code: string;
    name: string;
    status: string;
    management_mode: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
    default_locale: string;
    timezone: string;
    currency_code: string;
    country_code: string;
  };
  setup: {
    levels: number;
    academicYears: number;
    gradingPeriods: number;
    gradeLevels: number;
    sections: number;
  };
  staff: {
    schoolAdmins: number;
    teachers: number;
    financeAdmins: number;
    totalStaff: number;
  };
};

type Props = {
  data: SchoolDetail;
};

export function PlatformSchoolDetailClient({ data }: Props) {
  const pt = usePlatformCopy();

  const router = useRouter();

  const [form, setForm] = useState({
    name: data.school.name,
    defaultLocale: data.school.default_locale,
    timezone: data.school.timezone,
    currencyCode: data.school.currency_code,
    countryCode: data.school.country_code,
    managementMode: data.school.management_mode,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isManaged =
    form.managementMode === "SUPERADMIN_MANAGED" ||
    form.managementMode === "HYBRID_MANAGED";

  const setupCompletion = useMemo(() => {
    const checks = [
      data.setup.levels > 0,
      data.setup.academicYears > 0,
      data.setup.gradingPeriods > 0,
      data.setup.gradeLevels > 0,
      data.setup.sections > 0,
      data.school.status === "ACTIVE",
    ];

    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [data]);

  async function updateSchool(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/proxy/platform/schools/${data.school.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Update failed.");
      }

      setMessage(successMessage);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile() {
    await updateSchool(
      {
        name: form.name,
        defaultLocale: form.defaultLocale,
        timezone: form.timezone,
        currencyCode: form.currencyCode,
        countryCode: form.countryCode,
      },
      "School profile updated successfully.",
    );
  }

  async function saveManagementMode() {
    await updateSchool(
      { managementMode: form.managementMode },
      "Management mode updated successfully.",
    );
  }

  async function changeStatus(action: "activate" | "suspend" | "archive") {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        `/api/proxy/platform/schools/${data.school.id}/${action}`,
        {
          method: "POST",
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? `${action} failed.`);
      }

      setMessage("School status updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function openManagedWorkspace() {
    await fetch(`/api/proxy/platform/activity/managed-entry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schoolId: data.school.id }),
    });

    await fetch("/api/session/select-school", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ schoolId: data.school.id }),
    });

    router.push("/school");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-danger">
          {pt(platformErrorKey(error))}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-success/40 bg-success-subtle p-4 text-success">
          {pt(message)}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <StatusBadge status={data.school.status} />
        <ManagementModeBadge mode={data.school.management_mode} />
        <PlatformBadge tone="neutral">{data.school.code}</PlatformBadge>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPanel
          title={pt("School Profile")}
          subtitle={pt("Basic identity and operating configuration for this tenant.")}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">{pt("School Name")}</label>
              <input
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Default Locale")}</label>
              <select
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
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
              <label className="mb-1 block text-sm font-medium">{pt("Timezone")}</label>
              <input
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
                value={form.timezone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Currency")}</label>
              <input
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
                value={form.currencyCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    currencyCode: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Country")}</label>
              <input
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
                value={form.countryCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    countryCode: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              disabled={loading}
              onClick={() => void saveProfile()}
              className="rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >{pt("Save Profile")}{" "}</button>
          </div>
        </PlatformPanel>

        <PlatformPanel
          title={pt("Management Mode")}
          subtitle={pt("Define whether the school runs itself or is operated by the platform.")}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{pt("Management Mode")}</label>
              <select
                className="w-full rounded-xl border border-input bg-surface text-foreground px-3 py-2"
                value={form.managementMode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    managementMode: e.target.value as
                      | "SELF_MANAGED"
                      | "SUPERADMIN_MANAGED"
                      | "HYBRID_MANAGED",
                  }))
                }
              >
                <option value="SELF_MANAGED">{pt("SELF_MANAGED")}</option>
                <option value="SUPERADMIN_MANAGED">{pt("SUPERADMIN_MANAGED")}</option>
                <option value="HYBRID_MANAGED">{pt("HYBRID_MANAGED")}</option>
              </select>
            </div>

            <button
              disabled={loading}
              onClick={() => void saveManagementMode()}
              className="rounded-xl bg-primary px-4 py-3 text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >{pt("Save Management Mode")}{" "}</button>

            {isManaged ? (
              <button
                disabled={loading}
                onClick={() => void openManagedWorkspace()}
                className="rounded-xl border border-input bg-surface text-foreground px-4 py-3 hover:bg-surface-muted disabled:opacity-60"
              >{pt("Open Managed Workspace")}{" "}</button>
            ) : null}
          </div>
        </PlatformPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PlatformPanel title={pt("Onboarding Readiness")}>
          <div className="text-sm text-muted-foreground">{pt("Completion:")}{" "}<span className="font-semibold">{setupCompletion}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${setupCompletion}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PlatformStatCard label={pt("Levels")} value={data.setup.levels} />
            <PlatformStatCard label={pt("Academic Years")} value={data.setup.academicYears} />
            <PlatformStatCard label={pt("Grading Periods")} value={data.setup.gradingPeriods} />
            <PlatformStatCard label={pt("Grade Levels")} value={data.setup.gradeLevels} />
            <div className="sm:col-span-2">
              <PlatformStatCard label={pt("Sections")} value={data.setup.sections} />
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={`/platform/onboarding?search=${encodeURIComponent(data.school.name)}`}
              className="inline-flex rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-sm font-medium hover:bg-surface-muted"
            >{pt("Open Onboarding Tracker")}{" "}</Link>
          </div>
        </PlatformPanel>

        <PlatformPanel title={pt("Staff Summary")}>
          <div className="grid gap-3">
            <PlatformStatCard label={pt("School Admins")} value={data.staff.schoolAdmins} />
            <PlatformStatCard label={pt("Teachers")} value={data.staff.teachers} />
            <PlatformStatCard label={pt("Finance Admins")} value={data.staff.financeAdmins} />
            <PlatformStatCard label={pt("Total Staff")} value={data.staff.totalStaff} />
          </div>

          <div className="mt-4">
            <Link
              href={`/platform/staff?schoolId=${data.school.id}`}
              className="inline-flex rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-sm font-medium hover:bg-surface-muted"
            >{pt("Open Staff for This School")}{" "}</Link>
          </div>
        </PlatformPanel>

        <PlatformPanel title={pt("Lifecycle Actions")}>
          <div className="space-y-3">
            <button
              disabled={loading}
              onClick={() => void changeStatus("activate")}
              className="w-full rounded-xl bg-success px-4 py-3 text-success-foreground hover:bg-success disabled:opacity-60"
            >{pt("Activate")}{" "}</button>

            <button
              disabled={loading}
              onClick={() => void changeStatus("suspend")}
              className="w-full rounded-xl bg-warning-subtle0 px-4 py-3 text-warning-foreground hover:bg-warning disabled:opacity-60"
            >{pt("Suspend")}{" "}</button>

            <button
              disabled={loading}
              onClick={() => void changeStatus("archive")}
              className="w-full rounded-xl bg-danger px-4 py-3 text-danger-foreground hover:bg-danger disabled:opacity-60"
            >{pt("Archive")}{" "}</button>

            <Link
              href={`/platform/activity?schoolId=${data.school.id}`}
              className="block w-full rounded-xl border border-input bg-surface text-foreground px-4 py-3 text-center text-sm font-medium hover:bg-surface-muted"
            >{pt("View School Activity")}{" "}</Link>
          </div>
        </PlatformPanel>
      </div>
    </div>
  );
}
