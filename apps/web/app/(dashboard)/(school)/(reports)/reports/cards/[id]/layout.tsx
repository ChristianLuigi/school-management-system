import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function AdminOnlyRouteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN"]}>
      {children}
    </SchoolRoleGuard>
  );
}
