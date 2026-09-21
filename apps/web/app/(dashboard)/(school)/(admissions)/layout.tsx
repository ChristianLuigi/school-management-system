import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function AdmissionsRoutesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard
      allowedRoles={["SCHOOL_ADMIN", "ADMIN_STAFF", "TEACHER", "FINANCE_ADMIN"]}
    >
      {children}
    </SchoolRoleGuard>
  );
}
