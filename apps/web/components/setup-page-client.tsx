"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [status, setStatus] = useState<SetupStatus | null>(null);

  const [academicYearFr, setAcademicYearFr] = useState("Annee academique 2025-2026");
  const [academicYearEn, setAcademicYearEn] = useState("Academic Year 2025-2026");
  const [startDate, setStartDate] = useState("2025-09-01");
  const [endDate, setEndDate] = useState("2026-06-30");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");


  useEffect(() => {
    async function loadStatus() {
      if (!schoolId) return;

      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `${API_PROXY_PREFIX}/school-setup/status?schoolId=${schoolId}`,
          { cache: "no-store" },
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text);
        }

        const data = await res.json();
        setStatus(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load setup status.");
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, [schoolId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!schoolId) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
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
          gradingPeriods: [
            {
              code: "T1",
              nameI18n: {
                fr: "1er Trimestre",
                en: "Trimester 1",
              },
              startDate: "2025-09-01",
              endDate: "2025-11-30",
              displayOrder: 1,
            },
            {
              code: "T2",
              nameI18n: {
                fr: "2e Trimestre",
                en: "Trimester 2",
              },
              startDate: "2025-12-01",
              endDate: "2026-02-28",
              displayOrder: 2,
            },
            {
              code: "T3",
              nameI18n: {
                fr: "3e Trimestre",
                en: "Trimester 3",
              },
              startDate: "2026-03-01",
              endDate: "2026-06-30",
              displayOrder: 3,
            },
          ],
          gradeLevels: [
            {
              schoolLevelCode: "PRIM",
              code: "G1",
              nameI18n: {
                fr: "1ere annee",
                en: "Grade 1",
              },
              displayOrder: 1,
              sections: [
                {
                  code: "A",
                  nameI18n: {
                    fr: "Section A",
                    en: "Section A",
                  },
                  displayOrder: 1,
                },
              ],
            },
            {
              schoolLevelCode: "SEC",
              code: "6EME",
              nameI18n: {
                fr: "6eme",
                en: "Grade 6",
              },
              displayOrder: 1,
              sections: [
                {
                  code: "A",
                  nameI18n: {
                    fr: "Section A",
                    en: "Section A",
                  },
                  displayOrder: 1,
                },
                {
                  code: "B",
                  nameI18n: {
                    fr: "Section B",
                    en: "Section B",
                  },
                  displayOrder: 2,
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      setMessage("School setup completed successfully.");

      const refresh = await fetch(
        `${API_PROXY_PREFIX}/school-setup/status?schoolId=${schoolId}`,
        { cache: "no-store" },
      );

      if (refresh.ok) {
        const data = await refresh.json();
        setStatus(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete setup.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">School Setup Wizard</h1>
          <p className="mt-1 text-slate-600">
            Initialize the academic structure for a newly onboarded school.
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            Loading setup status...
          </div>
        ) : null}

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

        {status ? (
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">Current Setup Status</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Levels</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.levels}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Academic Years</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.academicYears}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Periods</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.gradingPeriods}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Grade Levels</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.gradeLevels}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-sm text-slate-500">Sections</div>
                <div className="mt-1 text-2xl font-bold">{status.counts.sections}</div>
              </div>
            </div>

            <div className="mt-4">
              <span
                className={`rounded-full px-3 py-2 text-sm font-medium ${
                  status.isComplete
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {status.isComplete ? "Setup Complete" : "Setup Incomplete"}
              </span>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <h2 className="text-lg font-semibold">Bootstrap School</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Academic Year Name (FR)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={academicYearFr}
                onChange={(e) => setAcademicYearFr(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Academic Year Name (EN)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={academicYearEn}
                onChange={(e) => setAcademicYearEn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!schoolId || submitting || status?.isComplete}
            className="rounded-xl bg-slate-900 px-5 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "Applying Setup..." : "Complete Initial Setup"}
          </button>
        </form>
      </div>
  );
}


