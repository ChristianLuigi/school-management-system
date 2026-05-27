"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";

type PayrollProfile = {
  id: string;
  fullName: string;
  jobTitle: string | null;
  baseSalary: number;
  currencyCode: string;
  payrollActive: boolean;
  notes: string | null;
  createdAt: string;
};

type PayrollRun = {
  id: string;
  payrollNumber: string | null;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  payrollStatus: string;
  currencyCode: string;
  totalGross: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNet: number;
  createdAt: string;
};

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

export function PayrollLiteClient({ schoolId }: { schoolId: string }) {
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openProfile, setOpenProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [profileCurrencyCode, setProfileCurrencyCode] = useState("USD");
  const [profileNotes, setProfileNotes] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [openRun, setOpenRun] = useState(false);
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [runCurrencyCode, setRunCurrencyCode] = useState("USD");
  const [runNotes, setRunNotes] = useState("");
  const [creatingRun, setCreatingRun] = useState(false);

  const activeProfiles = profiles.filter((profile) => profile.payrollActive);
  const activeGross = activeProfiles.reduce(
    (total, profile) => total + profile.baseSalary,
    0,
  );

  async function loadProfiles() {
    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/finance/payroll/profiles?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payroll profiles.");
      }

      setProfiles(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payroll profiles.",
      );
    }
  }

  async function loadRuns() {
    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(`/api/finance/payroll/runs?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load payroll runs.");
      }

      setRuns(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load payroll runs.",
      );
    }
  }

  async function loadPayroll() {
    setLoading(true);
    setError("");

    try {
      await Promise.all([loadProfiles(), loadRuns()]);
    } finally {
      setLoading(false);
    }
  }

  async function createPayrollProfile() {
    setCreatingProfile(true);
    setMessage("");
    setError("");

    try {
      if (!fullName.trim()) {
        throw new Error("Staff name is required.");
      }

      const salary = Number(baseSalary);

      if (!Number.isFinite(salary) || salary < 0) {
        throw new Error("Base salary must be zero or greater.");
      }

      const res = await fetch("/api/finance/payroll/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          fullName,
          jobTitle: jobTitle || undefined,
          baseSalary: salary,
          currencyCode: profileCurrencyCode,
          notes: profileNotes || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create payroll profile.");
      }

      setMessage(`${body.fullName} added to payroll.`);
      setOpenProfile(false);
      setFullName("");
      setJobTitle("");
      setBaseSalary("");
      setProfileCurrencyCode("USD");
      setProfileNotes("");

      await loadProfiles();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create payroll profile.",
      );
    } finally {
      setCreatingProfile(false);
    }
  }

  async function createPayrollRun() {
    setCreatingRun(true);
    setMessage("");
    setError("");

    try {
      if (!periodLabel.trim()) {
        throw new Error("Payroll period label is required.");
      }

      const res = await fetch("/api/finance/payroll/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          periodLabel,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          currencyCode: runCurrencyCode,
          notes: runNotes || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create payroll run.");
      }

      setMessage(`Payroll run ${body.payrollNumber ?? ""} created successfully.`);
      setOpenRun(false);
      setPeriodLabel("");
      setPeriodStart("");
      setPeriodEnd("");
      setRunCurrencyCode("USD");
      setRunNotes("");

      await loadRuns();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create payroll run.",
      );
    } finally {
      setCreatingRun(false);
    }
  }

  useEffect(() => {
    loadPayroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payroll</h1>
          <p className="mt-1 text-sm text-slate-600">
            Prepare staff salary profiles and generate payroll runs.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayroll}
          disabled={loading}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Active staff</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {activeProfiles.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Active gross</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {money(activeGross, profileCurrencyCode)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Payroll runs</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {runs.length}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Payroll Runs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate payroll from active staff salary profiles.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpenRun((value) => !value)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {openRun ? "Close" : "New Payroll Run"}
          </button>
        </div>

        {openRun ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                placeholder="Period label, example: June 2026 Payroll"
                value={periodLabel}
                onChange={(event) => setPeriodLabel(event.target.value)}
              />

              <input
                type="date"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />

              <input
                type="date"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                value={runCurrencyCode}
                onChange={(event) => setRunCurrencyCode(event.target.value)}
              >
                <option value="USD">USD</option>
                <option value="HTG">HTG</option>
              </select>
            </div>

            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Notes optional"
              value={runNotes}
              onChange={(event) => setRunNotes(event.target.value)}
            />

            <button
              type="button"
              disabled={creatingRun}
              onClick={createPayrollRun}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingRun ? "Generating..." : "Generate Payroll Run"}
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {run.payrollNumber ?? "Payroll Run"}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {run.periodLabel}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {run.periodStart ?? "-"} to {run.periodEnd ?? "-"}
                  </div>
                </div>

                <SchoolBadge tone={run.payrollStatus === "DRAFT" ? "blue" : "green"}>
                  {run.payrollStatus}
                </SchoolBadge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Gross</div>
                  <div className="font-semibold">
                    {money(run.totalGross, run.currencyCode)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Allowances</div>
                  <div className="font-semibold">
                    {money(run.totalAllowances, run.currencyCode)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Deductions</div>
                  <div className="font-semibold">
                    {money(run.totalDeductions, run.currencyCode)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Net</div>
                  <div className="font-semibold">
                    {money(run.totalNet, run.currencyCode)}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/finance/payroll/runs/${run.id}`}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                >
                  Open Run
                </Link>
              </div>
            </div>
          ))}

          {runs.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No payroll runs yet.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Staff Payroll Profiles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Active profiles are included when a payroll run is generated.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpenProfile((value) => !value)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {openProfile ? "Close" : "Add Staff Profile"}
          </button>
        </div>

        {openProfile ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Job title optional"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
              />

              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Base salary"
                value={baseSalary}
                onChange={(event) => setBaseSalary(event.target.value)}
              />

              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                value={profileCurrencyCode}
                onChange={(event) => setProfileCurrencyCode(event.target.value)}
              >
                <option value="USD">USD</option>
                <option value="HTG">HTG</option>
              </select>
            </div>

            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Notes optional"
              value={profileNotes}
              onChange={(event) => setProfileNotes(event.target.value)}
            />

            <button
              type="button"
              disabled={creatingProfile}
              onClick={createPayrollProfile}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingProfile ? "Saving..." : "Save Staff Profile"}
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">
                    {profile.fullName}
                  </div>

                  <div className="mt-1 text-sm text-slate-600">
                    {profile.jobTitle ?? "Staff member"}
                  </div>
                </div>

                <SchoolBadge tone={profile.payrollActive ? "green" : "neutral"}>
                  {profile.payrollActive ? "ACTIVE" : "INACTIVE"}
                </SchoolBadge>
              </div>

              <div className="mt-3 text-sm">
                <span className="text-slate-500">Base salary: </span>
                <span className="font-semibold">
                  {money(profile.baseSalary, profile.currencyCode)}
                </span>
              </div>
            </div>
          ))}

          {profiles.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              No staff payroll profiles yet.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
