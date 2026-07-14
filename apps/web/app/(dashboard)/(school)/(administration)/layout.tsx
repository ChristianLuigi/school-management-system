import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function AdministrationRoutesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN"]}>
      {children}
    </SchoolRoleGuard>
  );
}
