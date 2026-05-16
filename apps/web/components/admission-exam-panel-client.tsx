"use client";

import { useEffect, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";

type AdmissionExam = {
  id: string;
  examStatus: string;
  scheduledAt: string | null;
  location: string | null;
  supervisorName: string | null;
  frenchScore: number | null;
  mathScore: number | null;
  englishScore: number | null;
  generalScore: number | null;
  interviewScore: number | null;
  totalScore: number | null;
  maxScore: number;
  decisionStatus: string | null;
  notes: string | null;
};

function examStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_SCHEDULED: "Non planifie",
    SCHEDULED: "Planifie",
    COMPLETED: "Complete",
    CANCELLED: "Annule",
  };

  return labels[status] ?? status;
}

function decisionLabel(status: string | null) {
  const labels: Record<string, string> = {
    PENDING: "En attente",
    ADMITTED: "Admis",
    CONDITIONALLY_ADMITTED: "Admis sous condition",
    WAITLISTED: "Liste d'attente",
    REJECTED: "Refuse",
  };

  return status ? labels[status] ?? status : "-";
}

function toneForExam(status: string) {
  if (status === "COMPLETED") return "green";
  if (status === "SCHEDULED") return "blue";
  if (status === "CANCELLED") return "red";
  return "amber";
}

function numberOrUndefined(value: string) {
  if (value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function AdmissionExamPanelClient({
  schoolId,
  admissionApplicationId,
  exam,
  convertedStudentId,
  onUpdated,
}: {
  schoolId: string;
  admissionApplicationId: string;
  exam: AdmissionExam | null;
  convertedStudentId?: string | null;
  onUpdated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [examStatus, setExamStatus] = useState(exam?.examStatus ?? "SCHEDULED");
  const [scheduledAt, setScheduledAt] = useState(
    exam?.scheduledAt ? exam.scheduledAt.slice(0, 16) : "",
  );
  const [location, setLocation] = useState(exam?.location ?? "");
  const [supervisorName, setSupervisorName] = useState(
    exam?.supervisorName ?? "",
  );
  const [frenchScore, setFrenchScore] = useState(
    exam?.frenchScore == null ? "" : String(exam.frenchScore),
  );
  const [mathScore, setMathScore] = useState(
    exam?.mathScore == null ? "" : String(exam.mathScore),
  );
  const [englishScore, setEnglishScore] = useState(
    exam?.englishScore == null ? "" : String(exam.englishScore),
  );
  const [generalScore, setGeneralScore] = useState(
    exam?.generalScore == null ? "" : String(exam.generalScore),
  );
  const [interviewScore, setInterviewScore] = useState(
    exam?.interviewScore == null ? "" : String(exam.interviewScore),
  );
  const [totalScore, setTotalScore] = useState(
    exam?.totalScore == null ? "" : String(exam.totalScore),
  );
  const [maxScore, setMaxScore] = useState(String(exam?.maxScore ?? 100));
  const [decisionStatus, setDecisionStatus] = useState(
    exam?.decisionStatus ?? "PENDING",
  );
  const [notes, setNotes] = useState(exam?.notes ?? "");
  const [syncAdmissionStatus, setSyncAdmissionStatus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setExamStatus(exam?.examStatus ?? "SCHEDULED");
    setScheduledAt(exam?.scheduledAt ? exam.scheduledAt.slice(0, 16) : "");
    setLocation(exam?.location ?? "");
    setSupervisorName(exam?.supervisorName ?? "");
    setFrenchScore(exam?.frenchScore == null ? "" : String(exam.frenchScore));
    setMathScore(exam?.mathScore == null ? "" : String(exam.mathScore));
    setEnglishScore(exam?.englishScore == null ? "" : String(exam.englishScore));
    setGeneralScore(exam?.generalScore == null ? "" : String(exam.generalScore));
    setInterviewScore(
      exam?.interviewScore == null ? "" : String(exam.interviewScore),
    );
    setTotalScore(exam?.totalScore == null ? "" : String(exam.totalScore));
    setMaxScore(String(exam?.maxScore ?? 100));
    setDecisionStatus(exam?.decisionStatus ?? "PENDING");
    setNotes(exam?.notes ?? "");
  }, [exam]);

  async function saveExam() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/admissions/${admissionApplicationId}/exam`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          examStatus,
          scheduledAt: scheduledAt || undefined,
          location,
          supervisorName,
          frenchScore: numberOrUndefined(frenchScore),
          mathScore: numberOrUndefined(mathScore),
          englishScore: numberOrUndefined(englishScore),
          generalScore: numberOrUndefined(generalScore),
          interviewScore: numberOrUndefined(interviewScore),
          totalScore: numberOrUndefined(totalScore),
          maxScore: numberOrUndefined(maxScore) ?? 100,
          decisionStatus,
          notes,
          syncAdmissionStatus,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to update admission exam.");
      }

      setMessage("Admission exam updated successfully.");
      setOpen(false);
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update admission exam.",
      );
    } finally {
      setSaving(false);
    }
  }

  const locked = Boolean(convertedStudentId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Examen d'admission
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Planifier l'examen, saisir les resultats et enregistrer la decision.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <SchoolBadge
              tone={toneForExam(exam?.examStatus ?? "NOT_SCHEDULED") as any}
            >
              {examStatusLabel(exam?.examStatus ?? "NOT_SCHEDULED")}
            </SchoolBadge>

            {exam?.decisionStatus ? (
              <SchoolBadge
                tone={exam.decisionStatus === "REJECTED" ? "red" : "green"}
              >
                {decisionLabel(exam.decisionStatus)}
              </SchoolBadge>
            ) : null}
          </div>
        </div>

        {!locked ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {open ? "Close" : exam ? "Update Exam" : "Schedule Exam"}
          </button>
        ) : null}
      </div>

      {exam ? (
        <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-slate-500">Date</div>
            <div className="font-medium">
              {exam.scheduledAt ? new Date(exam.scheduledAt).toLocaleString() : "-"}
            </div>
          </div>

          <div>
            <div className="text-slate-500">Location</div>
            <div className="font-medium">{exam.location ?? "-"}</div>
          </div>

          <div>
            <div className="text-slate-500">Supervisor</div>
            <div className="font-medium">{exam.supervisorName ?? "-"}</div>
          </div>

          <div>
            <div className="text-slate-500">Total</div>
            <div className="font-medium">
              {exam.totalScore ?? "-"} / {exam.maxScore}
            </div>
          </div>

          <div>
            <div className="text-slate-500">Decision</div>
            <div className="font-medium">{decisionLabel(exam.decisionStatus)}</div>
          </div>

          <div>
            <div className="text-slate-500">Notes</div>
            <div className="font-medium">{exam.notes ?? "-"}</div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Aucun examen n'est encore planifie pour cette demande.
        </div>
      )}

      {message ? (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {open && !locked ? (
        <div className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={examStatus}
              onChange={(event) => setExamStatus(event.target.value)}
            >
              <option value="SCHEDULED">Planifie</option>
              <option value="COMPLETED">Complete</option>
              <option value="CANCELLED">Annule</option>
              <option value="NOT_SCHEDULED">Non planifie</option>
            </select>

            <input
              type="datetime-local"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Salle / lieu"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />

            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Surveillant / responsable"
              value={supervisorName}
              onChange={(event) => setSupervisorName(event.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="font-semibold text-slate-900">Resultats</div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Francais"
                value={frenchScore}
                onChange={(event) => setFrenchScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Mathematiques"
                value={mathScore}
                onChange={(event) => setMathScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Anglais"
                value={englishScore}
                onChange={(event) => setEnglishScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Culture generale"
                value={generalScore}
                onChange={(event) => setGeneralScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Entretien"
                value={interviewScore}
                onChange={(event) => setInterviewScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Total"
                value={totalScore}
                onChange={(event) => setTotalScore(event.target.value)}
              />
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Max score"
                value={maxScore}
                onChange={(event) => setMaxScore(event.target.value)}
              />
            </div>
          </div>

          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={decisionStatus}
            onChange={(event) => setDecisionStatus(event.target.value)}
          >
            <option value="PENDING">Decision en attente</option>
            <option value="ADMITTED">Admis</option>
            <option value="CONDITIONALLY_ADMITTED">Admis sous condition</option>
            <option value="WAITLISTED">Liste d'attente</option>
            <option value="REJECTED">Refuse</option>
          </select>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={syncAdmissionStatus}
              onChange={(event) => setSyncAdmissionStatus(event.target.checked)}
            />
            Synchroniser automatiquement le statut de la demande d'admission
          </label>

          <textarea
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            placeholder="Notes examen"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <button
            type="button"
            disabled={saving}
            onClick={saveExam}
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Exam"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
