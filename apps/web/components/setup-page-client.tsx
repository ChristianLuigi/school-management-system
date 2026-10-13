"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { canBootstrapSchool, buildSetupPeriods } from "@/lib/school-setup";

const API_PROXY_PREFIX = "/api/proxy";


type SetupStatus = {
  school: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
  counts: {
    levels: number;
    academicYears: number;
    gradingPeriods: number;
    gradeLevels: number;
    sections: number;
  };
  checks: {
    hasLevels: boolean;
    hasAcademicYear: boolean;
    hasGradingPeriods: boolean;
    hasGradeLevels: boolean;
    hasSections: boolean;
  };
  isComplete: boolean;
};

export function SetupPageClient({ schoolId }: { schoolId: string }) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [status, setStatus] = useState<SetupStatus | null>(null);

  const [academicYearFr, setAcademicYearFr] = useState("");
  const [academicYearEn, setAcademicYearEn] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");


  useEffect(() => {
    const controller = new AbortController();
    setStatus(null);
    async function loadStatus() {
      if (!schoolId) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${API_PROXY_PREFIX}/school-setup/status?schoolId=${schoolId}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error('setupLoad');
        }

        const data = await res.json();
        setStatus(data);
      } catch {
        if (!controller.signal.aborted) setError("setupLoad");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadStatus();
    return () => controller.abort();
  }, [schoolId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!schoolId || loading || submitting || !canBootstrapSchool(status)) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const gradingPeriods = buildSetupPeriods(startDate, endDate);
      const res = await fetch(`${API_PROXY_PREFIX}/school-setup/bootstrap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          academicYearNameI18n: {
            fr: academicYearFr,
            en: academicYearEn,
          },
          academicYearStartDate: startDate,
          academicYearEndDate: endDate,
          gradingPeriods,

        }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const latest = await fetch(`${API_PROXY_PREFIX}/school-setup/status?schoolId=${encodeURIComponent(schoolId)}`, { cache: "no-store" });
          if (latest.ok) setStatus(await latest.json());
        }
        throw new Error('setupSave');
      }

      setMessage(fr ? "Configuration initiale enregistrée." : "Initial setup saved.");

      const refresh = await fetch(
        `${API_PROXY_PREFIX}/school-setup/status?schoolId=${schoolId}`,
        { cache: "no-store" },
      );

      if (refresh.ok) {
        const data = await refresh.json();
        setStatus(data);
      }
    } catch {
      setError("setupSave");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">{fr ? "Configuration académique" : "Academic setup"}</h2>
          <p className="mt-1 text-muted-foreground">
            {fr ? "L’initialisation est réservée aux écoles sans année académique." : "Initialization is only available for schools without an academic year."}
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-surface text-foreground p-4 shadow-sm ring-1 ring-slate-200">
            {fr ? "Vérification…" : "Checking setup…"}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-danger">
            {error === "setupLoad" ? (fr ? "Impossible de vérifier la configuration. Rechargez la page." : "Unable to check setup. Reload this page.") : (fr ? "Configuration refusée. Vérifiez les dates et la configuration actuelle de l’école." : "Setup was rejected. Check the dates and the school's current configuration.")}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-success/40 bg-success-subtle p-4 text-success">
            {message}
          </div>
        ) : null}

        {status ? (
          <div className="rounded-2xl bg-surface text-foreground p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="text-lg font-semibold">{fr ? "Configuration actuelle" : "Current configuration"}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-sm text-muted-foreground">{fr ? "Cycles" : "Levels"}</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.levels}</div>
              </div>
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-sm text-muted-foreground">{fr ? "Années" : "Academic years"}</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.academicYears}</div>
              </div>
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-sm text-muted-foreground">{fr ? "Périodes" : "Periods"}</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.gradingPeriods}</div>
              </div>
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-sm text-muted-foreground">{fr ? "Niveaux" : "Grade levels"}</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.gradeLevels}</div>
              </div>
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="text-sm text-muted-foreground">{fr ? "Classes" : "Sections"}</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.sections}</div>
              </div>
            </div>

            {status.counts.gradeLevels === 0 || status.counts.sections === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {fr ? "Structure académique à compléter dans Académie." : "Complete the academic structure in Academics."}
              </div>
            ) : null}

            <div className="mt-4">
              <span
                className={`rounded-full px-3 py-2 text-sm font-medium ${
                  status.isComplete
                    ? "bg-green-100 text-success"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {status.isComplete ? (fr ? "Initialisation terminée" : "Initialization complete") : (fr ? "Configuration à compléter" : "Configuration incomplete")}
              </span>
            </div>
          </div>
        ) : null}

        {!loading && status && !canBootstrapSchool(status) ? <div className="rounded-xl border border-border bg-surface-muted p-4">
          <p className="mb-3 text-sm">{fr ? "L’initialisation n’est pas disponible pour cette école. Gérez les années, périodes et classes dans Académie." : "Initialization is not available for this school. Manage years, periods and classes in Academics."}</p>
          <Link href="/academics" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">{fr ? "Ouvrir Académie" : "Open Academics"}</Link>
        </div> : null}
        {canBootstrapSchool(status) && !loading ? <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-surface text-foreground p-5 shadow-sm ring-1 ring-slate-200"
        >
          <h3 className="text-lg font-semibold">{fr ? "Créer la première année" : "Create the first academic year"}</h3>
          <p className="text-sm text-muted-foreground">{fr ? "Trois périodes consécutives seront réparties sur les dates choisies. Vous pourrez les ajuster dans Académie." : "Three consecutive periods will be distributed across the selected dates. You can adjust them in Academics."}</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                {fr ? "Nom de l’année — français" : "Academic year name — French"}
              </label>
              <input
                className="w-full rounded-lg border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2"
                required value={academicYearFr}
                onChange={(e) => setAcademicYearFr(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                {fr ? "Nom de l’année — anglais" : "Academic year name — English"}
              </label>
              <input
                className="w-full rounded-lg border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2"
                required value={academicYearEn}
                onChange={(e) => setAcademicYearEn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">{fr ? "Début" : "Start date"}</label>
              <input
                type="date"
                className="w-full rounded-lg border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2"
                required value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">{fr ? "Fin" : "End date"}</label>
              <input
                type="date"
                className="w-full rounded-lg border border-input bg-surface text-foreground placeholder:text-muted-foreground px-3 py-2"
                required min={startDate || undefined} value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!schoolId || submitting || !canBootstrapSchool(status)}
            className="rounded-xl bg-primary px-5 py-3 text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {submitting ? (fr ? "Initialisation…" : "Initializing…") : (fr ? "Initialiser l’école" : "Initialize school")}
          </button>
        </form> : null}
      </div>
  );
}


