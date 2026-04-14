import Link from "next/link";
import { SchoolPageShell } from "@/components/school-page-shell";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";
import { serverApiGet } from "@/lib/server-api";

type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  status: string;
};

export default async function StudentsPage() {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);

  const students = await serverApiGet<Student[]>(
    `/students?schoolId=${schoolId}`,
  );

  return (
    <SchoolPageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="mt-1 text-slate-600">
            All enrolled students for this school.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm text-slate-500">Total Students</div>
          <div className="mt-2 text-3xl font-bold">{students.length}</div>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Student #</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Gender</th>
                <th className="px-4 py-3">Date of Birth</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-t border-slate-200 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/students/${student.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {student.student_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {student.first_name} {student.last_name}
                  </td>
                  <td className="px-4 py-3">{student.gender ?? "—"}</td>
                  <td className="px-4 py-3">{student.date_of_birth ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        student.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </SchoolPageShell>
  );
}
