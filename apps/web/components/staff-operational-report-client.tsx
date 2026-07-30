"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

type Report = {
  generatedAt: string;
  credentialWindowDays: number;
  totals: {
    staff: number;
    unlinkedAccounts: number;
    missingPayrollProfiles: number;
    teachersWithoutAssignments: number;
    expiredCredentials: number;
    expiringCredentials: number;
    pendingLeaveRequests: number;
  };
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  credentialAlerts: Array<{
    documentId: string;
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    documentType: string;
    displayName: string;
    expiresOn: string;
    expiryStatus: "EXPIRED" | "EXPIRING_SOON";
  }>;
  leaveQueue: Array<{
    leaveRequestId: string;
    staffId: string;
    staffCode: string | null;
    firstName: string | null;
    lastName: string | null;
    leaveType: string;
    status: string;
    startDate: string;
    endDate: string;
  }>;
};

const COPY = {
  fr: {
    back: "Retour au personnel",
    loading: "Chargement du rapport…",
    window: "Fenêtre d’expiration",
    days: "jours",
    export: "Exporter CSV",
    generated: "Généré",
    staff: "Personnel total",
    unlinked: "Comptes non liés",
    payroll: "Profils de paie manquants",
    assignments: "Enseignants sans affectation",
    expired: "Qualifications expirées",
    expiring: "Qualifications à renouveler",
    pendingLeave: "Congés en attente",
    status: "Répartition par statut",
    category: "Répartition par catégorie",
    credentials: "Alertes de qualifications",
    leave: "File des congés",
    none: "Aucune alerte.",
    open: "Ouvrir le dossier",
  },
  en: {
    back: "Back to staff",
    loading: "Loading report…",
    window: "Expiry window",
    days: "days",
    export: "Export CSV",
    generated: "Generated",
    staff: "Total staff",
    unlinked: "Unlinked accounts",
    payroll: "Missing payroll profiles",
    assignments: "Teachers without assignments",
    expired: "Expired credentials",
    expiring: "Credentials to renew",
    pendingLeave: "Pending leave requests",
    status: "By employment status",
    category: "By staff category",
    credentials: "Credential alerts",
    leave: "Leave queue",
    none: "No alerts.",
    open: "Open record",
  },
} as const;

function staffName(item: {
  firstName: string | null;
  lastName: string | null;
  staffCode: string | null;
}) {
  return (
    [item.firstName, item.lastName].filter(Boolean).join(" ") ||
    item.staffCode ||
    "—"
  );
}

export function StaffOperationalReportClient({
  schoolId,
}: {
  schoolId: string;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [windowDays, setWindowDays] = useState(60);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        schoolId,
        credentialWindowDays: String(windowDays),
      });
      const response = await fetch(
        `/api/staff-management/reports/operational?${query}`,
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load staff report.");
      }
      setReport(body);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load staff report.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ["metric", "value"],
      ["total_staff", report.totals.staff],
      ["unlinked_accounts", report.totals.unlinkedAccounts],
      ["missing_payroll_profiles", report.totals.missingPayrollProfiles],
      [
        "teachers_without_assignments",
        report.totals.teachersWithoutAssignments,
      ],
      ["expired_credentials", report.totals.expiredCredentials],
      ["expiring_credentials", report.totals.expiringCredentials],
      ["pending_leave_requests", report.totals.pendingLeaveRequests],
      [],
      ["credential_staff", "document_type", "display_name", "expires_on"],
      ...report.credentialAlerts.map((item) => [
        staffName(item),
        item.documentType,
        item.displayName,
        item.expiresOn,
      ]),
      [],
      ["leave_staff", "leave_type", "status", "start_date", "end_date"],
      ...report.leaveQueue.map((item) => [
        staffName(item),
        item.leaveType,
        item.status,
        item.startDate,
        item.endDate,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `staff-operational-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const cards = report
    ? [
        [copy.staff, report.totals.staff],
        [copy.unlinked, report.totals.unlinkedAccounts],
        [copy.payroll, report.totals.missingPayrollProfiles],
        [copy.assignments, report.totals.teachersWithoutAssignments],
        [copy.expired, report.totals.expiredCredentials],
        [copy.expiring, report.totals.expiringCredentials],
        [copy.pendingLeave, report.totals.pendingLeaveRequests],
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/staff" className="text-sm font-medium text-blue-700">
          ← {copy.back}
        </Link>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">
            {copy.window}{" "}
            <select
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="rounded-lg border border-slate-300 px-2 py-1"
            >
              {[30, 60, 90, 180].map((days) => (
                <option key={days} value={days}>
                  {days} {copy.days}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!report}
            onClick={exportCsv}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {copy.export}
          </button>
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">{copy.loading}</p> : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}
      {report ? (
        <>
          <p className="text-xs text-slate-500">
            {copy.generated}:{" "}
            {new Intl.DateTimeFormat(locale === "fr" ? "fr-HT" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(report.generatedAt))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {label}
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Breakdown title={copy.status} values={report.statusCounts} />
            <Breakdown title={copy.category} values={report.categoryCounts} />
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.credentials}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.credentialAlerts.length ? (
                <p className="text-sm text-slate-500">{copy.none}</p>
              ) : null}
              {report.credentialAlerts.map((item) => (
                <div
                  key={item.documentId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.displayName} · {item.expiresOn}
                    </div>
                  </div>
                  <Link
                    href={`/staff/${encodeURIComponent(item.staffId)}`}
                    className="text-sm font-medium text-blue-700"
                  >
                    {copy.open}
                  </Link>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              {copy.leave}
            </h2>
            <div className="mt-4 space-y-3">
              {!report.leaveQueue.length ? (
                <p className="text-sm text-slate-500">{copy.none}</p>
              ) : null}
              {report.leaveQueue.map((item) => (
                <div
                  key={item.leaveRequestId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-950">
                      {staffName(item)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {item.leaveType.replaceAll("_", " ")} · {item.startDate} —
                      {" "}
                      {item.endDate} · {item.status}
                    </div>
                  </div>
                  <Link
                    href={`/staff/${encodeURIComponent(item.staffId)}`}
                    className="text-sm font-medium text-blue-700"
                  >
                    {copy.open}
                  </Link>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 space-y-2">
        {Object.entries(values).map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">{label.replaceAll("_", " ")}</span>
            <span className="font-semibold text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
