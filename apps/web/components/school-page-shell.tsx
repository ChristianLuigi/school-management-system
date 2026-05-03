import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { SchoolSwitcher } from "@/components/school-switcher";
import {
  canSuperAdminManageSchool,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

type SchoolPageShellProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
};

export async function SchoolPageShell({
  children,
  allowedRoles,
}: SchoolPageShellProps) {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  if (!currentSchoolId) {
    redirect("/login");
  }

  const superAdminManagedAccess = canSuperAdminManageSchool(context);

  if (context.isSuperAdmin && !superAdminManagedAccess) {
    redirect("/platform");
  }

  const effectiveRoles = resolveEffectiveRoles(context);

  if (
    allowedRoles?.length &&
    !allowedRoles.some((role) => effectiveRoles.includes(role))
  ) {
    redirect("/school");
  }

  const currentSchoolName =
    context.currentSchool && "school_name" in context.currentSchool
      ? context.currentSchool.school_name
      : context.currentSchool && "name" in context.currentSchool
        ? context.currentSchool.name
        : "School";

  const currentSchoolCode =
    context.currentSchool && "school_code" in context.currentSchool
      ? context.currentSchool.school_code
      : context.currentSchool && "code" in context.currentSchool
        ? context.currentSchool.code
        : "";

  return (
    <AdminShell
      currentRoles={effectiveRoles}
      schoolName={currentSchoolName}
      schoolCode={currentSchoolCode}
      headerExtra={
        context.availableSchools?.length ? (
          <SchoolSwitcher
            schools={context.availableSchools}
            currentSchoolId={currentSchoolId}
          />
        ) : null
      }
    >
      {superAdminManagedAccess ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          You are managing this school as Platform Operator.
        </div>
      ) : null}

      {children}
    </AdminShell>
  );
}
