"use client";

import { useEffect, useState } from "react";

export type SelectedStudent = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  sectionCode: string | null;
  sectionNameI18n: Record<string, string> | null;
};

function studentDisplayName(student: SelectedStudent) {
  const name = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
  return name || student.studentCode || student.id;
}

function studentClassLabel(student: SelectedStudent) {
  const grade =
    student.gradeLevelNameI18n?.fr ??
    student.gradeLevelNameI18n?.en ??
    student.gradeLevelCode;

  const section =
    student.sectionNameI18n?.fr ??
    student.sectionNameI18n?.en ??
    student.sectionCode;

  if (!grade && !section) return "No active class";

  return [grade, section].filter(Boolean).join(" - ");
}

export function StudentSelectorClient({
  schoolId,
  selectedStudent,
  onSelect,
  label = "Student",
}: {
  schoolId: string;
  selectedStudent: SelectedStudent | null;
  onSelect: (student: SelectedStudent | null) => void;
  label?: string;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SelectedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchStudents(value: string) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        schoolId,
        search: value,
      });

      const res = await fetch(`/api/finance/students/search?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to search students.");
      }

      setResults(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search students.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchStudents(search);
    }, 300);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, search]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="text-sm font-semibold text-foreground">{label}</div>

      {selectedStudent ? (
        <div className="mt-3 rounded-xl border border-border bg-surface p-3">
          <div className="font-semibold text-foreground">
            {studentDisplayName(selectedStudent)}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {selectedStudent.studentCode ?? "Code pending"}
            </span>{" "}
            · {studentClassLabel(selectedStudent)}
          </div>

          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mt-3 rounded-lg border border-input px-3 py-2 text-xs hover:bg-surface"
          >
            Change student
          </button>
        </div>
      ) : (
        <>
          <input
            className="mt-3 w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
            placeholder="Search by name or student code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {error ? (
            <div className="mt-3 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
                Searching students...
              </div>
            ) : null}

            {results.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => {
                  onSelect(student);
                  setSearch("");
                  setResults([]);
                }}
                className="w-full rounded-xl border border-border bg-surface p-3 text-left hover:bg-surface"
              >
                <div className="font-semibold text-foreground">
                  {studentDisplayName(student)}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {student.studentCode ?? "Code pending"}
                  </span>{" "}
                  · {studentClassLabel(student)}
                </div>
              </button>
            ))}

            {!loading && results.length === 0 ? (
              <div className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
                No students found.
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
