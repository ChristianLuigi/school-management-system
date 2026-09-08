"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  ListPlus,
  PencilLine,
  RefreshCw,
  Save,
} from "lucide-react";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";

type Assessment = {
  id: string;
  subjectName: string;
  title: string;
  assessmentType: string;
  assessmentDate: string | null;
  maxPoints: number;
  weightPercent: number;
  scoreCount: number;
  averageScore: number | null;
};

type GradeLevelSubject = {
  id: string;
  subjectId: string;
  code: string;
  nameI18n: Record<string, string> | null;
  coefficient: number;
  displayOrder: number;
  isRequired: boolean;
};

type ScoreStudent = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  score: number | null;
  note: string | null;
};

const ASSESSMENT_TYPES = [
  "HOMEWORK",
  "QUIZ",
  "EXAM",
  "PROJECT",
  "PARTICIPATION",
  "OTHER",
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function studentName(student: ScoreStudent, unnamedLabel: string) {
  return (
    `${student.lastName ?? ""} ${student.firstName ?? ""}`.trim() || unnamedLabel
  );
}

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

export function GradebookMvpClient({
  schoolId,
  initialSectionId = "",
  initialSubjectId = "",
  canManageStructure = false,
}: {
  schoolId: string;
  initialSectionId?: string;
  initialSubjectId?: string;
  canManageStructure?: boolean;
}) {
  const { locale, t } = useI18n();
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [subjects, setSubjects] = useState<GradeLevelSubject[]>([]);
  const [subjectId, setSubjectId] = useState(initialSubjectId);
  const [sectionSelectionReady, setSectionSelectionReady] = useState(false);
  const [subjectSelectionReady, setSubjectSelectionReady] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const [title, setTitle] = useState("");
  const [assessmentType, setAssessmentType] = useState("QUIZ");
  const [assessmentDate, setAssessmentDate] = useState(todayIsoDate());
  const [maxPoints, setMaxPoints] = useState("20");
  const [weightPercent, setWeightPercent] = useState("100");

  const [students, setStudents] = useState<ScoreStudent[]>([]);
  const [scores, setScores] = useState<
    Record<string, { score: string; note: string }>
  >({});

  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedAssessment = assessments.find(
    (assessment) => assessment.id === selectedAssessmentId,
  );

  const classAverage = useMemo(() => {
    const numericScores = Object.values(scores)
      .map((entry) => Number(entry.score))
      .filter((value) => Number.isFinite(value));

    if (numericScores.length === 0) return null;

    const total = numericScores.reduce((sum, value) => sum + value, 0);
    return total / numericScores.length;
  }, [scores]);

  async function loadSubjectsForSection() {
    setMessage("");
    setError("");

    if (!sectionId) {
      setSubjects([]);
      setSubjectId("");
      setSubjectSelectionReady(true);
      setAssessments([]);
      setSelectedAssessmentId("");
      setStudents([]);
      setScores({});
      return;
    }

    try {
      const params = new URLSearchParams({ schoolId });
      const res = await fetch(
        `/api/academic/sections/${sectionId}/subjects?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("gradebooks.loadFailed"));
      }

      const nextSubjects: GradeLevelSubject[] = Array.isArray(body) ? body : [];
      setSubjects(nextSubjects);
      setSubjectId((current) =>
        nextSubjects.some((subject) => subject.subjectId === current)
          ? current
          : (nextSubjects[0]?.subjectId ?? ""),
      );
      setSubjectSelectionReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("gradebooks.loadFailed"));
    }
  }

  async function loadAssessments() {
    setMessage("");

    if (!sectionId || !subjectId) {
      setAssessments([]);
      setSelectedAssessmentId("");
      setStudents([]);
      setScores({});
      return;
    }

    setLoadingAssessments(true);

    try {
      const params = new URLSearchParams({
        schoolId,
        sectionId,
        subjectId,
      });

      const res = await fetch(
        `/api/gradebooks/assessments?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("gradebooks.loadFailed"));
      }

      setAssessments(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("gradebooks.loadFailed"),
      );
    } finally {
      setLoadingAssessments(false);
    }
  }

  async function createAssessment() {
    setMessage("");
    setError("");

    if (!sectionId) {
      setError(t("gradebooks.selectClassFirst"));
      return;
    }

    if (!subjectId) {
      setError(t("gradebooks.selectSubjectFirst"));
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/gradebooks/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          sectionId,
          subjectId,
          title,
          assessmentType,
          assessmentDate: assessmentDate || undefined,
          maxPoints: Number(maxPoints),
          weightPercent: Number(weightPercent),
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("gradebooks.createFailed"));
      }

      setMessage(t("gradebooks.assessmentCreated"));
      setTitle("");
      await loadAssessments();
      await loadScores(body.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("gradebooks.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function loadScores(assessmentId: string) {
    setSelectedAssessmentId(assessmentId);
    setMessage("");
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });
      const res = await fetch(
        `/api/gradebooks/assessments/${assessmentId}/scores?${params.toString()}`,
        { cache: "no-store" },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("gradebooks.scoresLoadFailed"));
      }

      setStudents(body.students);

      const nextScores: Record<string, { score: string; note: string }> = {};

      for (const student of body.students as ScoreStudent[]) {
        nextScores[student.id] = {
          score: student.score === null ? "" : String(student.score),
          note: student.note ?? "",
        };
      }

      setScores(nextScores);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("gradebooks.scoresLoadFailed"),
      );
    }
  }

  async function saveScores() {
    setMessage("");
    setError("");

    if (!selectedAssessmentId) {
      setError(t("gradebooks.selectAssessmentFirst"));
      return;
    }

    setSaving(true);

    try {
      const payloadScores = Object.entries(scores).map(
        ([studentId, value]) => ({
          studentId,
          score: value.score === "" ? undefined : Number(value.score),
          note: value.note,
        }),
      );

      const res = await fetch("/api/gradebooks/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          assessmentId: selectedAssessmentId,
          scores: payloadScores,
        }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? t("gradebooks.scoresSaveFailed"));
      }

      setMessage(t("gradebooks.scoresSaved"));
      await loadAssessments();
      await loadScores(selectedAssessmentId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("gradebooks.scoresSaveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sectionId) params.set("sectionId", sectionId);
    else params.delete("sectionId");
    if (subjectId) params.set("subjectId", subjectId);
    else params.delete("subjectId");
    window.history.replaceState(
      window.history.state,
      "",
      params.size
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname,
    );
  }, [sectionId, subjectId]);

  useEffect(() => {
    if (!sectionSelectionReady) return;
    loadSubjectsForSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, sectionSelectionReady]);

  useEffect(() => {
    if (!sectionSelectionReady || !subjectSelectionReady) return;
    loadAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, subjectId, sectionSelectionReady, subjectSelectionReady]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-violet-50 p-2 text-violet-700">
            <BookOpenCheck className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-slate-950">
            {t("gradebooks.workspaceTitle")}
          </h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={(value) => {
              setSubjectSelectionReady(false);
              setSectionId(value);
            }}
            onSectionDetailsChange={() => setSectionSelectionReady(true)}
            label={t("gradebooks.classSection")}
            allowEmpty
            autoSelectFirst
            disableFullSections={false}
            includePlanned={false}
            emptyActionHref={
              canManageStructure ? "/academic-structure" : "/academics"
            }
            emptyActionLabel={
              canManageStructure
                ? t("gradebooks.configure")
                : t("gradebooks.myClasses")
            }
          />

          <div>
            <label className="block text-sm font-medium text-slate-700">
              {t("gradebooks.subject")}
            </label>
            <select
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t("gradebooks.selectSubject")}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.subjectId}>
                  {i18nName(subject.nameI18n, subject.code, locale)} -{" "}
                  {t("gradebooks.coefficient")}{" "}
                  {subject.coefficient}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sectionId && subjects.length === 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {canManageStructure
              ? t("gradebooks.noConfiguredSubjects")
              : t("gradebooks.noAssignedSubjectsForClass")}
          </div>
        ) : null}

        {message ? (
          <div role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {sectionId ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">
            {t("gradebooks.createAssessment")}
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("gradebooks.assessmentTitle")}
              placeholder={t("gradebooks.assessmentTitle")}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <select
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={assessmentType}
              onChange={(event) => setAssessmentType(event.target.value)}
            >
              {ASSESSMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`gradebooks.assessmentTypes.${type}`)}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label={t("attendance.date")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={assessmentDate}
              onChange={(event) => setAssessmentDate(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("gradebooks.maxPoints")}
              placeholder={t("gradebooks.maxPoints")}
              value={maxPoints}
              onChange={(event) => setMaxPoints(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              aria-label={t("gradebooks.weight")}
              placeholder={t("gradebooks.weight")}
              value={weightPercent}
              onChange={(event) => setWeightPercent(event.target.value)}
            />

            <button
              type="button"
              onClick={createAssessment}
              disabled={saving || !subjectId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <ListPlus className="h-4 w-4" />
              {saving
                ? t("gradebooks.creating")
                : t("gradebooks.createAssessment")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">
              {t("gradebooks.assessments")}
            </h3>
            <button
              type="button"
              onClick={loadAssessments}
              disabled={loadingAssessments || !sectionId || !subjectId}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingAssessments ? "animate-spin" : ""}`}
              />
              {loadingAssessments
                ? t("gradebooks.loadingAssessments")
                : t("common.refresh")}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <div className="font-semibold">{assessment.title}</div>
                    <div className="text-sm text-slate-500">
                      {assessment.subjectName} -{" "}
                      {t(
                        `gradebooks.assessmentTypes.${assessment.assessmentType}`,
                      )}{" "}
                      - /
                      {assessment.maxPoints}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("gradebooks.average")}:{" "}
                      {assessment.averageScore === null
                        ? "-"
                        : assessment.averageScore.toFixed(2)}
                    </div>
                  </div>

                  <SchoolBadge tone="blue">
                    {t("gradebooks.scoresCount", {
                      count: assessment.scoreCount,
                    })}
                  </SchoolBadge>
                </div>

                <button
                  type="button"
                  onClick={() => loadScores(assessment.id)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                >
                  <PencilLine className="h-3.5 w-3.5" />
                  {t("gradebooks.enterScores")}
                </button>
              </div>
            ))}

            {assessments.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {t("gradebooks.noAssessments")}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                {t("gradebooks.scores")}
              </h3>
              {selectedAssessment ? (
                <p className="mt-1 text-sm text-slate-600">
                  {selectedAssessment.title} / {selectedAssessment.maxPoints}
                </p>
              ) : null}
            </div>

            <SchoolBadge tone="green">
              {t("gradebooks.classAverage", {
                value:
                  classAverage === null ? "-" : classAverage.toFixed(2),
              })}
            </SchoolBadge>
          </div>

          {selectedAssessmentId ? (
            <>
              <div className="mt-4 space-y-3">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3"
                  >
                    <div>
                      <div className="font-medium">{studentName(student, t("gradebooks.unnamedStudent"))}</div>
                      <div className="text-xs text-slate-500">
                        {student.studentCode ?? "-"}
                      </div>
                    </div>

                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      aria-label={`${t("gradebooks.score")}: ${studentName(
                        student,
                        t("gradebooks.unnamedStudent"),
                      )}`}
                      placeholder={t("gradebooks.score")}
                      value={scores[student.id]?.score ?? ""}
                      onChange={(event) =>
                        setScores((current) => ({
                          ...current,
                          [student.id]: {
                            ...(current[student.id] ?? { note: "" }),
                            score: event.target.value,
                          },
                        }))
                      }
                    />

                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      aria-label={`${t("attendance.note")}: ${studentName(
                        student,
                        t("gradebooks.unnamedStudent"),
                      )}`}
                      placeholder={t("attendance.note")}
                      value={scores[student.id]?.note ?? ""}
                      onChange={(event) =>
                        setScores((current) => ({
                          ...current,
                          [student.id]: {
                            ...(current[student.id] ?? { score: "" }),
                            note: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={saveScores}
                disabled={saving}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? t("common.saving") : t("gradebooks.saveScores")}
              </button>
            </>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
              {t("gradebooks.selectAssessment")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
