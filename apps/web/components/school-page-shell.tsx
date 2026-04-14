import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SchoolSwitcher } from "@/components/school-switcher";
import {
  getMeContext,
  resolveCurrentSchoolId,
} from "@/lib/server-context";

type SchoolPageShellProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
  headerExtra?: React.ReactNode;
};

export async function SchoolPageShell({
  children,
  allowedRoles,
  headerExtra,
}: SchoolPageShellProps) {
  const context = await getMeContext();

  if (context.isSuperAdmin) {
    redirect("/platform");
  }

  const currentSchoolId = resolveCurrentSchoolId(context);

  if (!currentSchoolId) {
    redirect("/login");
  }

  if (
    allowedRoles?.length &&
    !allowedRoles.some((role) => context.currentRoles.includes(role))
  ) {
    redirect("/school");
  }

  const fallbackHeaderExtra = context.availableSchools?.length ? (
    <SchoolSwitcher
      schools={context.availableSchools}
      currentSchoolId={currentSchoolId}
    />
  ) : null;

  return (
    <AdminShell
      currentRoles={context.currentRoles}
      headerExtra={headerExtra ?? fallbackHeaderExtra}
    >
      {children}
    </AdminShell>
  );
}