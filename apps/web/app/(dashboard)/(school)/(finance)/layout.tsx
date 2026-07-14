import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function FinanceRoutesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      {children}
    </SchoolRoleGuard>
  );
}
