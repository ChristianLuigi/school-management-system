"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { SchoolBadge } from "@/components/school-ui";

type StudentRow = {
  id: string;
  studentCode: string | null;
  firstName: string | null;
  lastName: string | null;
  gradeLevelCode: string | null;
  gradeLevelNameI18n: Record<string, string> | null;
  sectionCode: string | null;
  sectionNameI18n: Record<string, string> | null;
  createdAt: string;
};

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
) {
  return value?.fr ?? value?.en ?? fallback;
}

function classLabel(student: StudentRow) {
  const grade = i18nName(
    student.gradeLevelNameI18n,
    student.gradeLevelCode ?? "",
  );

  const section = i18nName(student.sectionNameI18n, student.sectionCode ?? "");
  const value = [grade, section].filter(Boolean).join(" - ");

  return value || "No active class";
}

function studentName(student: StudentRow) {
  const name = `${student.firstName ?? ""} ${student.lastName ?? ""}`.trim();
  return name || student.studentCode || "Unnamed student";
}

export function StudentsManagementClient({
  schoolId,
  canCreate,
}: {
  schoolId: string;
  canCreate: boolean;
}) {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const res = await fetch(`/api/school-students?${params.toString()}`, {
        cache: "no-store",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load students.");
      }

      setRows(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load students.");
    } finally {
      setLoading(false);
    }
  }

  async function createStudent() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error("First name and last name are required.");
      }

      const res = await fetch("/api/school-students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          firstName,
          lastName,
          studentCode: studentCode || undefined,
          sectionId: sectionId || undefined,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to create student.");
      }

      setMessage(
        `Student created successfully: ${body.studentCode ?? "code pending"}`,
      );
      setFirstName("");
      setLastName("");
      setStudentCode("");
      setSectionId("");
      setOpenCreate(false);

      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create student.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Student Management
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Create students, assign them to a section, and search existing records.
            </p>
          </div>

          {canCreate ? (
            <button
              type="button"
              onClick={() => setOpenCreate((value) => !value)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {openCreate ? "Close" : "Add Student"}
            </button>
          ) : null}
        </div>

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

        {openCreate && canCreate ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                placeholder="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />

              <input
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm md:col-span-2"
                placeholder="Student code optional - leave empty for automatic code"
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value)}
              />

              <div className="md:col-span-2">
                <SectionSelectorClient
                  schoolId={schoolId}
                  sectionId={sectionId}
                  onSectionIdChange={setSectionId}
                  label="Assign to section optional"
                  allowEmpty
                />
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={createStudent}
              className="mt-5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create Student"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">Students</h4>
            <p className="mt-1 text-sm text-slate-600">
              Search by name or student code.
            </p>
          </div>

          <button
            type="button"
            onClick={loadStudents}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            className="min-w-[280px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search students..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <button
            type="button"
            onClick={loadStudents}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Search
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((student) => (
                <tr key={student.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {studentName(student)}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {student.studentCode ?? "Code pending"}
                  </td>

                  <td className="px-4 py-3">{classLabel(student)}</td>

                  <td className="px-4 py-3">
                    <SchoolBadge tone="green">Active</SchoolBadge>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/students/${student.id}`}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Open Profile
                      </Link>

                      {canCreate ? (
                        <Link
                          href={`/students/${student.id}/edit`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}

              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


