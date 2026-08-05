import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function StaffSelfServiceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard
      allowedRoles={["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"]}
    >
      {children}
    </SchoolRoleGuard>
  );
}
