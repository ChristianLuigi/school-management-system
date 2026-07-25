"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_PROXY_PREFIX = "/api/proxy";

type SectionSubject = {
  id: string;
  section_id: string;
  section_code: string;
  section_name_i18n: Record<string, string>;
  subject_code: string;
  subject_name_i18n: Record<string, string>;
};

type GradingPeriod = {
  id: string;
  name_i18n: Record<string, string>;
  sequence_no: number;
  is_current: boolean;
};

type Gradebook = {
  id: string;
  section_subject_id: string;
  grading_period_id: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PUBLISHED" | "REJECTED";
};

type Assessment = {
  id: string;
  gradebook_id: string;
  title_i18n: Record<string, string>;
  assessment_type: "HOMEWORK" | "EXAM" | "QUIZ" | "PARTICIPATION" | "PROJECT";
  assessment_date: string;
  max_points_possible: string;
  weight_percent: string;
  display_order: number;
};

type ScoreRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  raw_score: string;
  teacher_comment_i18n: Record<string, string> | null;
  student_number: string;
  student_first_name: string;
  student_last_name: string;
};

type Readiness = {
  gradebookId: string;
  status: string;
  assessmentCount: number;
  totalWeightPercent: number;
  expectedStudentCount: number;
  scoredEntriesCount: number;
  requiredScoreEntriesCount: number;
  missingScoreEntriesCount: number;
  isWeightValid: boolean;
  isComplete: boolean;
  canSubmit: boolean;
};

type RosterStudent = {
  student_id: string;
  student_number: string;
  first_name: string;
  last_name: string;
};

async function parseApiResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return null as T;
  }

  const text = await res.text();

  if (!text.trim()) {
    return null as T;
  }

  return JSON.parse(text) as T;
}

type GradebooksPageClientProps = {
  userId: string;
  sectionSubjects: SectionSubject[];
  gradingPeriods: GradingPeriod[];
};

export function GradebooksPageClient({
  userId,
  sectionSubjects,
  gradingPeriods,
}: GradebooksPageClientProps) {
  const [sectionSubjectId, setSectionSubjectId] = useState<string>(
    sectionSubjects[0]?.id ?? "",
  );
  const [gradingPeriodId, setGradingPeriodId] = useState<string>(
    gradingPeriods.find((p) => p.is_current)?.id ?? gradingPeriods[0]?.id ?? "",
  );

  const [gradebook, setGradebook] = useState<Gradebook | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [assessmentForm, setAssessmentForm] = useState({
    frTitle: "Devoir 1",
    enTitle: "Homework 1",
    assessmentType: "HOMEWORK",
    assessmentDate: "2025-10-01",
    maxPointsPossible: "20",
    weightPercent: "40",
    displayOrder: "1",
  });

  const currentSectionId = useMemo(
    () =>
      sectionSubjects.find((ss) => ss.id === sectionSubjectId)?.section_id ??
      "",
    [sectionSubjects, sectionSubjectId],
  );

  async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${API_PROXY_PREFIX}${path}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GET failed: ${res.status} ${text}`);
    }

    return parseApiResponse<T>(res);
  }

  async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_PROXY_PREFIX}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`POST failed: ${res.status} ${text}`);
    }

    return parseApiResponse<T>(res);
  }

  async function loadPageData() {
    if (!sectionSubjectId || !gradingPeriodId) {
      setRoster([]);
      setGradebook(null);
      setAssessments([]);
      setReadiness(null);
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const rosterData = await apiGet<RosterStudent[]>(
        `/attendance/roster?sectionId=${currentSectionId}`,
      );

      setRoster(rosterData);

      let existingGradebook = await apiGet<Gradebook | null>(
        `/gradebooks?sectionSubjectId=${sectionSubjectId}&gradingPeriodId=${gradingPeriodId}`,
      );

      if (!existingGradebook) {
        existingGradebook = await apiPost<Gradebook>("/gradebooks/init", {
          sectionSubjectId,
          gradingPeriodId,
        });
      }

      setGradebook(existingGradebook);

      const [assessmentsData, readinessData] = await Promise.all([
        apiGet<Assessment[]>(
          `/assessments?gradebookId=${existingGradebook.id}`,
        ),
        apiGet<Readiness>(
          `/gradebooks/readiness?gradebookId=${existingGradebook.id}`,
        ),
      ]);

      setAssessments(assessmentsData);
      setReadiness(readinessData);

      if (assessmentsData.length > 0) {
        setSelectedAssessmentId((prev) => prev || assessmentsData[0].id);
      } else {
        setSelectedAssessmentId("");
      }

      setMessage("Gradebook loaded.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load gradebook.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionSubjectId, gradingPeriodId]);

  async function loadScores(assessmentId: string) {
    if (!assessmentId) {
      setScores({});
      return;
    }

    try {
      const data = await apiGet<ScoreRow[]>(
        `/assessment-scores?assessmentId=${assessmentId}`,
      );

      const nextScores: Record<string, string> = {};
      for (const student of roster) {
        nextScores[student.student_id] = "";
      }
      for (const row of data) {
        nextScores[row.student_id] = row.raw_score;
      }

      setScores(nextScores);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scores.");
    }
  }

  useEffect(() => {
    if (selectedAssessmentId) {
      loadScores(selectedAssessmentId);
    } else {
      setScores({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAssessmentId, roster.length]);

  async function handleCreateAssessment(e: FormEvent) {
    e.preventDefault();
    if (!gradebook) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      await apiPost<Assessment>("/assessments", {
        gradebookId: gradebook.id,
        titleI18n: {
          fr: assessmentForm.frTitle,
          en: assessmentForm.enTitle,
        },
        assessmentType: assessmentForm.assessmentType,
        assessmentDate: assessmentForm.assessmentDate,
        maxPointsPossible: Number(assessmentForm.maxPointsPossible),
        weightPercent: Number(assessmentForm.weightPercent),
        displayOrder: Number(assessmentForm.displayOrder),
      });

      await loadPageData();
      setMessage("Assessment created successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create assessment.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveScores(e: FormEvent) {
    e.preventDefault();
    if (!selectedAssessmentId) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      await apiPost("/assessment-scores/bulk-upsert", {
        assessmentId: selectedAssessmentId,
        enteredByUserId: userId,
        scores: roster.map((student) => ({
          studentId: student.student_id,
          rawScore: Number(scores[student.student_id] || 0),
        })),
      });

      if (gradebook) {
        const readinessData = await apiGet<Readiness>(
          `/gradebooks/readiness?gradebookId=${gradebook.id}`,
        );
        setReadiness(readinessData);
      }

      setMessage("Scores saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save scores.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitGradebook() {
    if (!gradebook) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const updated = await apiPost<Gradebook>("/gradebooks/submit", {
        gradebookId: gradebook.id,
        submittedByUserId: userId,
      });

      setGradebook(updated);

      const readinessData = await apiGet<Readiness>(
        `/gradebooks/readiness?gradebookId=${gradebook.id}`,
      );
      setReadiness(readinessData);

      setMessage("Gradebook submitted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit gradebook.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveGradebook() {
    if (!gradebook) return;

    setActionLoading(true);
    setError("");
    setMessage("");

    try {
      const updated = await apiPost<Gradebook>("/gradebooks/approve", {
        gradebookId: gradebook.id,
        approvedByUserId: userId,
      });

      setGradebook(updated);

      const readinessData = await apiGet<Readiness>(
        `/gradebooks/readiness?gradebookId=${gradebook.id}`,
      );
      setReadiness(readinessData);

      setMessage("Gradebook approved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve gradebook.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Section Subject
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={sectionSubjectId}
            onChange={(e) => setSectionSubjectId(e.target.value)}
          >
            {sectionSubjects.map((ss) => (
              <option key={ss.id} value={ss.id}>
                {ss.section_name_i18n.fr ?? ss.section_code} &middot;{" "}
                {ss.subject_name_i18n.fr ?? ss.subject_code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Grading Period
          </label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={gradingPeriodId}
            onChange={(e) => setGradingPeriodId(e.target.value)}
          >
            {gradingPeriods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_i18n.fr ?? p.name_i18n.en ?? `Period ${p.sequence_no}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={loadPageData}
            disabled={loading}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Reload Gradebook"}
          </button>
        </div>
      </div>

      {gradebook ? (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Status</div>
            <div className="mt-2 text-2xl font-bold">{gradebook.status}</div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Assessments</div>
            <div className="mt-2 text-2xl font-bold">
              {readiness?.assessmentCount ?? 0}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Weight Total</div>
            <div className="mt-2 text-2xl font-bold">
              {readiness?.totalWeightPercent ?? 0}%
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">Missing Scores</div>
            <div className="mt-2 text-2xl font-bold">
              {readiness?.missingScoreEntriesCount ?? 0}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={handleCreateAssessment}
          className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <h2 className="text-lg font-semibold">Create Assessment</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              French Title
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={assessmentForm.frTitle}
              onChange={(e) =>
                setAssessmentForm((prev) => ({
                  ...prev,
                  frTitle: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              English Title
            </label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={assessmentForm.enTitle}
              onChange={(e) =>
                setAssessmentForm((prev) => ({
                  ...prev,
                  enTitle: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={assessmentForm.assessmentType}
              onChange={(e) =>
                setAssessmentForm((prev) => ({
                  ...prev,
                  assessmentType: e.target.value,
                }))
              }
            >
              <option value="HOMEWORK">HOMEWORK</option>
              <option value="EXAM">EXAM</option>
              <option value="QUIZ">QUIZ</option>
              <option value="PARTICIPATION">PARTICIPATION</option>
              <option value="PROJECT">PROJECT</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={assessmentForm.assessmentDate}
                onChange={(e) =>
                  setAssessmentForm((prev) => ({
                    ...prev,
                    assessmentDate: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Max Points
              </label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={assessmentForm.maxPointsPossible}
                onChange={(e) =>
                  setAssessmentForm((prev) => ({
                    ...prev,
                    maxPointsPossible: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Weight %</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={assessmentForm.weightPercent}
                onChange={(e) =>
                  setAssessmentForm((prev) => ({
                    ...prev,
                    weightPercent: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Display Order
            </label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              value={assessmentForm.displayOrder}
              onChange={(e) =>
                setAssessmentForm((prev) => ({
                  ...prev,
                  displayOrder: e.target.value,
                }))
              }
            />
          </div>

          <button
            type="submit"
            disabled={!gradebook || actionLoading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {actionLoading ? "Working..." : "Create Assessment"}
          </button>
        </form>

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Workflow Actions</h2>

          <div className="grid gap-3">
            <button
              type="button"
              disabled={!gradebook || actionLoading || !readiness?.canSubmit}
              onClick={handleSubmitGradebook}
              className="rounded-xl bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Submit Gradebook
            </button>

            <button
              type="button"
              disabled={
                !gradebook || actionLoading || gradebook.status !== "SUBMITTED"
              }
              onClick={handleApproveGradebook}
              className="rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-50 disabled:opacity-60"
            >
              Approve Gradebook
            </button>
          </div>

          {readiness ? (
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <div>
                <span className="font-medium">Weight valid:</span>{" "}
                {readiness.isWeightValid ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-medium">Complete:</span>{" "}
                {readiness.isComplete ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-medium">Can submit:</span>{" "}
                {readiness.canSubmit ? "Yes" : "No"}
              </div>
              <div>
                <span className="font-medium">Scored entries:</span>{" "}
                {readiness.scoredEntriesCount} /{" "}
                {readiness.requiredScoreEntriesCount}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">Assessments</h2>

        <div className="mt-4 space-y-3">
          {assessments.map((assessment) => (
            <button
              key={assessment.id}
              type="button"
              onClick={() => setSelectedAssessmentId(assessment.id)}
              className={`block w-full rounded-xl border p-4 text-left transition ${
                selectedAssessmentId === assessment.id
                  ? "border-slate-900 bg-slate-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <div className="font-semibold">
                {assessment.title_i18n?.fr ?? assessment.id}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {assessment.assessment_type} | Date:{" "}
                {assessment.assessment_date}
                {" | "}Max: {assessment.max_points_possible}
                {" | "}Weight: {assessment.weight_percent}%
              </div>
            </button>
          ))}

          {assessments.length === 0 ? (
            <div className="text-sm text-slate-500">
              No assessments created yet.
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={handleSaveScores}
        className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Scores</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select an assessment above, then enter scores for each student.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Student #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Raw Score</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((student) => (
                <tr
                  key={student.student_id}
                  className="border-t border-slate-200"
                >
                  <td className="px-4 py-3">{student.student_number}</td>
                  <td className="px-4 py-3">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={scores[student.student_id] ?? ""}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [student.student_id]: e.target.value,
                        }))
                      }
                      disabled={!selectedAssessmentId}
                    />
                  </td>
                </tr>
              ))}

              {roster.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No roster found for this subject’s section.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            type="submit"
            disabled={
              !selectedAssessmentId || actionLoading || roster.length === 0
            }
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {actionLoading ? "Working..." : "Save Scores"}
          </button>
        </div>
      </form>
    </div>
  );
}
