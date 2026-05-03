"use client";

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

      setMessage(`School ${action}d successfully.`);
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
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
          {message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <StatusBadge status={data.school.status} />
        <ManagementModeBadge mode={data.school.management_mode} />
        <PlatformBadge tone="neutral">{data.school.code}</PlatformBadge>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PlatformPanel
          title="School Profile"
          subtitle="Basic identity and operating configuration for this tenant."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">School Name</label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Default Locale</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                value={form.timezone}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, timezone: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
              <label className="mb-1 block text-sm font-medium">Country</label>
              <input
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
              className="rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Save Profile
            </button>
          </div>
        </PlatformPanel>

        <PlatformPanel
          title="Management Mode"
          subtitle="Define whether the school runs itself or is operated by the platform."
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Management Mode</label>
              <select
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
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
                <option value="SELF_MANAGED">SELF_MANAGED</option>
                <option value="SUPERADMIN_MANAGED">SUPERADMIN_MANAGED</option>
                <option value="HYBRID_MANAGED">HYBRID_MANAGED</option>
              </select>
            </div>

            <button
              disabled={loading}
              onClick={() => void saveManagementMode()}
              className="rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Save Management Mode
            </button>

            {isManaged ? (
              <button
                disabled={loading}
                onClick={() => void openManagedWorkspace()}
                className="rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-50 disabled:opacity-60"
              >
                Open Managed Workspace
              </button>
            ) : null}
          </div>
        </PlatformPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <PlatformPanel title="Onboarding Readiness">
          <div className="text-sm text-slate-600">
            Completion: <span className="font-semibold">{setupCompletion}%</span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${setupCompletion}%` }}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PlatformStatCard label="Levels" value={data.setup.levels} />
            <PlatformStatCard label="Academic Years" value={data.setup.academicYears} />
            <PlatformStatCard label="Grading Periods" value={data.setup.gradingPeriods} />
            <PlatformStatCard label="Grade Levels" value={data.setup.gradeLevels} />
            <div className="sm:col-span-2">
              <PlatformStatCard label="Sections" value={data.setup.sections} />
            </div>
          </div>

          <div className="mt-4">
            <Link
              href={`/platform/onboarding?search=${encodeURIComponent(data.school.name)}`}
              className="inline-flex rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
            >
              Open Onboarding Tracker
            </Link>
          </div>
        </PlatformPanel>

        <PlatformPanel title="Staff Summary">
          <div className="grid gap-3">
            <PlatformStatCard label="School Admins" value={data.staff.schoolAdmins} />
            <PlatformStatCard label="Teachers" value={data.staff.teachers} />
            <PlatformStatCard label="Finance Admins" value={data.staff.financeAdmins} />
            <PlatformStatCard label="Total Staff" value={data.staff.totalStaff} />
          </div>

          <div className="mt-4">
            <Link
              href={`/platform/staff?schoolId=${data.school.id}`}
              className="inline-flex rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50"
            >
              Open Staff for This School
            </Link>
          </div>
        </PlatformPanel>

        <PlatformPanel title="Lifecycle Actions">
          <div className="space-y-3">
            <button
              disabled={loading}
              onClick={() => void changeStatus("activate")}
              className="w-full rounded-xl bg-green-600 px-4 py-3 text-white hover:bg-green-700 disabled:opacity-60"
            >
              Activate
            </button>

            <button
              disabled={loading}
              onClick={() => void changeStatus("suspend")}
              className="w-full rounded-xl bg-amber-500 px-4 py-3 text-white hover:bg-amber-600 disabled:opacity-60"
            >
              Suspend
            </button>

            <button
              disabled={loading}
              onClick={() => void changeStatus("archive")}
              className="w-full rounded-xl bg-red-600 px-4 py-3 text-white hover:bg-red-700 disabled:opacity-60"
            >
              Archive
            </button>

            <Link
              href={`/platform/activity?schoolId=${data.school.id}`}
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium hover:bg-slate-50"
            >
              View School Activity
            </Link>
          </div>
        </PlatformPanel>
      </div>
    </div>
  );
}
