"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SchoolBadge, type SchoolBadgeTone } from "@/components/school-ui";
import { PayrollCompensationEditor } from "@/components/payroll-compensation-editor";

type StaffOption = {
  id: string;
  fullName: string;
  email: string | null;
  staffCode: string | null;
  jobTitle: string | null;
  department: string | null;
  employmentStatus: string;
  hasPayrollProfile: boolean;
};

type PayrollProfile = {
  id: string;
  staffAccountId: string;
  fullName: string;
  staffCode: string | null;
  jobTitle: string | null;
  positionTitle: string | null;
  department: string | null;
  payFrequency: string;
  baseSalary: number;
  currencyCode: string;
  payrollActive: boolean;
  effectiveFrom?: string | null;
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
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function runTone(status: string): SchoolBadgeTone {
  if (status === "CLOSED" || status === "PAID") return "green";
  if (status === "APPROVED" || status === "PROCESSING") return "blue";
  if (["DRAFT", "UNDER_REVIEW", "PENDING_APPROVAL", "REVIEWED"].includes(status)) return "amber";
  if (status === "CANCELLED") return "red";
  return "neutral";
}

async function json(response: Response) {
  return response.json().catch(() => null);
}

export function PayrollLiteClient({
  schoolId,
  isSchoolAdmin,
}: {
  schoolId: string;
  isSchoolAdmin: boolean;
}) {
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [profiles, setProfiles] = useState<PayrollProfile[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showProfile, setShowProfile] = useState(false);
  const [staffAccountId, setStaffAccountId] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [profileCurrency, setProfileCurrency] = useState("HTG");
  const [profileActive, setProfileActive] = useState(true);
  const [profileNotes, setProfileNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showRun, setShowRun] = useState(false);
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [runCurrency, setRunCurrency] = useState("HTG");
  const [runNotes, setRunNotes] = useState("");
  const [savingRun, setSavingRun] = useState(false);

  const availableStaff = useMemo(
    () => staffOptions.filter((option) => !option.hasPayrollProfile),
    [staffOptions],
  );

  const currencyTotals = useMemo(() => {
    const totals = new Map<string, { count: number; gross: number }>();
    for (const profile of profiles) {
      if (!profile.payrollActive) continue;
      const current = totals.get(profile.currencyCode) ?? { count: 0, gross: 0 };
      totals.set(profile.currencyCode, {
        count: current.count + 1,
        gross: current.gross + profile.baseSalary,
      });
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [profiles]);

  const runProfileCount =
    currencyTotals.find(([currency]) => currency === runCurrency)?.[1].count ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ schoolId }).toString();
      const responses = await Promise.all([
        fetch(`/api/finance/payroll/staff-options?${query}`, { cache: "no-store" }),
        fetch(`/api/finance/payroll/profiles?${query}`, { cache: "no-store" }),
        fetch(`/api/finance/payroll/runs?${query}`, { cache: "no-store" }),
      ]);
      const bodies = await Promise.all(responses.map(json));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(bodies[failed]?.message ?? "Failed to load payroll.");
      setStaffOptions(Array.isArray(bodies[0]) ? bodies[0] : []);
      setProfiles(Array.isArray(bodies[1]) ? bodies[1] : []);
      setRuns(Array.isArray(bodies[2]) ? bodies[2] : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load payroll.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => void load(), [load]);

  async function createProfile() {
    setSavingProfile(true);
    setMessage("");
    setError("");
    try {
      const salary = Number(baseSalary);
      if (!staffAccountId) throw new Error("Select an eligible staff account.");
      if (!Number.isFinite(salary) || salary < 0) {
        throw new Error("Base salary must be zero or greater.");
      }
      const response = await fetch("/api/finance/payroll/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          schoolId,
          staffAccountId,
          baseSalary: salary,
          currencyCode: profileCurrency,
          payrollActive: profileActive,
          notes: profileNotes.trim() || undefined,
        }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to create payroll profile.");
      setMessage(`${body.fullName ?? "Staff member"} linked to payroll.`);
      setShowProfile(false);
      setStaffAccountId("");
      setBaseSalary("");
      setProfileCurrency("HTG");
      setProfileActive(true);
      setProfileNotes("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create payroll profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function createRun() {
    setSavingRun(true);
    setMessage("");
    setError("");
    try {
      if (!periodLabel.trim()) throw new Error("Payroll period label is required.");
      if (!periodStart || !periodEnd) throw new Error("Payroll period dates are required.");
      if (periodEnd < periodStart) {
        throw new Error("Payroll period end cannot be before its start.");
      }
      if (!runProfileCount) throw new Error(`No active ${runCurrency} profiles are available.`);
      const response = await fetch("/api/finance/payroll/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          schoolId,
          periodLabel: periodLabel.trim(),
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          currencyCode: runCurrency,
          notes: runNotes.trim() || undefined,
        }),
      });
      const body = await json(response);
      if (!response.ok) throw new Error(body?.message ?? "Failed to create payroll run.");
      setMessage(`Payroll ${body.payrollNumber ?? "run"} created with salary snapshots.`);
      setShowRun(false);
      setPeriodLabel("");
      setPeriodStart("");
      setPeriodEnd("");
      setRunCurrency("HTG");
      setRunNotes("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create payroll run.");
    } finally {
      setSavingRun(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payroll</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Link staff profiles, snapshot salary data, and move every payroll through review,
            approval, processing, payment, and close.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSchoolAdmin ? (
            <Link href="/finance/payroll/approvals" className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200">
              School Admin approval inbox
            </Link>
          ) : null}
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {message ? <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-sm text-slate-500">Active payroll staff</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{profiles.filter((profile) => profile.payrollActive).length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2">
          <div className="text-sm text-slate-500">Active salary by currency</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {currencyTotals.map(([currency, total]) => (
              <div key={currency}>
                <span className="text-xl font-bold text-slate-900">{money(total.gross, currency)}</span>
                <span className="ml-2 text-xs text-slate-500">{total.count} staff</span>
              </div>
            ))}
            {!currencyTotals.length ? <span className="text-sm text-slate-500">No active profiles yet.</span> : null}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Payroll runs</h2>
            <p className="mt-1 text-sm text-slate-600">Each run contains one currency and immutable salary snapshots.</p>
          </div>
          <button type="button" onClick={() => setShowRun((value) => !value)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {showRun ? "Close" : "New payroll run"}
          </button>
        </div>
        {showRun ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm"><span className="font-medium">Period label</span><input className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="Example: June 2026 payroll" value={periodLabel} onChange={(event) => setPeriodLabel(event.target.value)} /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm"><span className="font-medium">Period start</span><input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
              <label className="text-sm"><span className="font-medium">Period end</span><input type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
            </div>
            <label className="block text-sm"><span className="font-medium">Currency</span><select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={runCurrency} onChange={(event) => setRunCurrency(event.target.value)}><option value="HTG">HTG</option><option value="USD">USD</option></select><span className="mt-1 block text-xs text-slate-500">{runProfileCount} active profile(s) will be included.</span></label>
            <textarea className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Preparation notes (optional)" value={runNotes} onChange={(event) => setRunNotes(event.target.value)} />
            <button type="button" disabled={savingRun || !runProfileCount} onClick={() => void createRun()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{savingRun ? "Creating..." : "Create draft payroll"}</button>
          </div>
        ) : null}
        <div className="mt-5 space-y-3">
          {runs.map((run) => (
            <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{run.payrollNumber ?? "Payroll run"}</div><div className="mt-1 text-sm text-slate-600">{run.periodLabel}</div><div className="mt-1 text-xs text-slate-500">{run.periodStart ?? "No start"} to {run.periodEnd ?? "no end"} · {run.currencyCode}</div></div><SchoolBadge tone={runTone(run.payrollStatus)}>{run.payrollStatus.replaceAll("_", " ")}</SchoolBadge></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Gross", run.totalGross], ["Allowances", run.totalAllowances], ["Deductions", run.totalDeductions], ["Net", run.totalNet]].map(([label, value]) => <div key={String(label)}><div className="text-xs text-slate-500">{label}</div><div className="font-semibold">{money(Number(value), run.currencyCode)}</div></div>)}</div>
              <Link href={`/finance/payroll/runs/${run.id}`} className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">Open run</Link>
            </article>
          ))}
          {!runs.length && !loading ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No payroll runs yet.</div> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Linked staff payroll profiles</h2><p className="mt-1 text-sm text-slate-600">Names and positions come from active school staff records.</p></div>{isSchoolAdmin ? <button type="button" onClick={() => setShowProfile((value) => !value)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">{showProfile ? "Close" : "Link staff profile"}</button> : null}</div>
        {showProfile ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-sm"><span className="font-medium">Staff account</span><select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={staffAccountId} onChange={(event) => setStaffAccountId(event.target.value)}><option value="">Select eligible staff</option>{availableStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}{staff.staffCode ? ` · ${staff.staffCode}` : ""}{staff.jobTitle ? ` · ${staff.jobTitle}` : ""}</option>)}</select>{!availableStaff.length ? <span className="mt-1 block text-xs text-slate-500">All eligible staff already have profiles.</span> : null}</label>
            <div className="grid gap-4 md:grid-cols-2"><label className="text-sm"><span className="font-medium">Base salary per pay period</span><input type="number" min="0" step="0.01" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={baseSalary} onChange={(event) => setBaseSalary(event.target.value)} /></label><label className="text-sm"><span className="font-medium">Currency</span><select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={profileCurrency} onChange={(event) => setProfileCurrency(event.target.value)}><option value="HTG">HTG</option><option value="USD">USD</option></select></label></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={profileActive} onChange={(event) => setProfileActive(event.target.checked)} />Include in new payroll runs</label>
            <textarea className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Payroll notes (optional)" value={profileNotes} onChange={(event) => setProfileNotes(event.target.value)} />
            <button type="button" disabled={savingProfile || !availableStaff.length} onClick={() => void createProfile()} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60">{savingProfile ? "Saving..." : "Save linked profile"}</button>
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {profiles.map((profile) => (
            <article
              key={profile.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{profile.fullName}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    {profile.positionTitle ?? profile.jobTitle ?? "School staff member"}
                    {profile.department ? ` · ${profile.department}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {profile.staffCode ? `Code ${profile.staffCode} · ` : ""}
                    {profile.payFrequency?.replaceAll("_", " ") || "Monthly"}
                    {profile.effectiveFrom ? ` · Effective ${profile.effectiveFrom}` : ""}
                  </div>
                </div>
                <SchoolBadge tone={profile.payrollActive ? "green" : "neutral"}>
                  {profile.payrollActive ? "ACTIVE" : "INACTIVE"}
                </SchoolBadge>
              </div>
              <div className="mt-3 text-sm">
                <span className="text-slate-500">Base salary per pay period: </span>
                <span className="font-semibold">
                  {money(profile.baseSalary, profile.currencyCode)}
                </span>
              </div>
              {isSchoolAdmin ? (
                <PayrollCompensationEditor
                  schoolId={schoolId}
                  profile={profile}
                  onUpdated={load}
                />
              ) : null}
            </article>
          ))}
          {!profiles.length && !loading ? <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No linked payroll profiles yet.</div> : null}
        </div>
      </section>
    </div>
  );
}