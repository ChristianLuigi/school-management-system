import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SchoolSwitcher } from "@/components/school-switcher";
import { getServerTranslator } from "@/lib/i18n";
import { getSchoolNavigation } from "@/lib/navigation";
import {
  canSuperAdminManageSchool,
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function SchoolWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  if (!currentSchoolId) {
    redirect("/login");
  }

  const operatorAccess = canSuperAdminManageSchool(context);

  if (context.isSuperAdmin && !operatorAccess) {
    redirect("/platform");
  }

  const roles = resolveEffectiveRoles(context);
  const { locale } = await getServerTranslator();
  const school = context.currentSchool;
  const schoolName = school
    ? "school_name" in school
      ? school.school_name
      : school.name
    : "School";
  const schoolCode = school
    ? "school_code" in school
      ? school.school_code
      : school.code
    : "";
  const userName = [context.user.firstName, context.user.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <AppShell
      navigation={getSchoolNavigation(roles, locale)}
      workspaceLabel="School workspace"
      workspaceName={schoolName}
      workspaceCode={schoolCode}
      user={{ name: userName, email: context.user.email }}
      actions={
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {context.availableSchools.length > 0 ? (
            <SchoolSwitcher
              schools={context.availableSchools}
              currentSchoolId={currentSchoolId}
            />
          ) : null}
        </div>
      }
      notice={
        operatorAccess ? (
          <div
            role="status"
            className="mb-6 rounded-lg border border-warning bg-warning-subtle p-4 text-sm font-medium text-foreground"
          >
            You are managing this school as a platform operator.
          </div>
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}