import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function RegistrationReceiptRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      {children}
    </SchoolRoleGuard>
  );
}
