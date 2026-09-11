import { FinanceNavigation } from "@/components/finance-navigation";
import { SchoolRoleGuard } from "@/components/layout/school-role-guard";

export default function FinanceRoutesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SchoolRoleGuard allowedRoles={["SCHOOL_ADMIN", "FINANCE_ADMIN"]}>
      <div className="space-y-5">
        <FinanceNavigation />
        {children}
      </div>
    </SchoolRoleGuard>
  );
}
