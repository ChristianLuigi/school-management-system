import { AdminShell } from "@/components/admin-shell";
import { apiGet } from "@/lib/api";

type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  status: string;
};

const SCHOOL_ID = "11111111-1111-4111-8111-111111111111";

export default async function StudentsPage() {
  const students = await apiGet<Student[]>(
    `/students?schoolId=${SCHOOL_ID}`,
  );

  return (
    <AdminShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="mt-1 text-slate-600">
            Current students loaded from the API.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Student #</th>
                <th className="px-4 py-3">First Name</th>
                <th className="px-4 py-3">Last Name</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">{student.student_number}</td>
                  <td className="px-4 py-3">{student.first_name}</td>
                  <td className="px-4 py-3">{student.last_name}</td>
                  <td className="px-4 py-3">{student.status}</td>
                </tr>
              ))}

              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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
    </AdminShell>
  );
}