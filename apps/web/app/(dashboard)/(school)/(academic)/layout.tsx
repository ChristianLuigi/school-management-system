import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function AcademicRoutesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN", "TEACHER"]}>
      {children}
    </SchoolRoleGuard>
  );
}
