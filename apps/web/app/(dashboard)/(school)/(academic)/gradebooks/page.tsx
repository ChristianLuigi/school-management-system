import { GradebookMvpClient } from "@/components/gradebook-mvp-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GradebooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    sectionId?: string | string[];
    subjectId?: string | string[];
  }>;
}) {
  const [context, query] = await Promise.all([getMeContext(), searchParams]);
  const currentSchoolId = resolveCurrentSchoolId(context);
  const roles = resolveEffectiveRoles(context);
  const canManageStructure = roles.includes("SCHOOL_ADMIN");

  return (
    <SchoolModuleWorkspace
      compact
      title="Gradebooks"
      description="Create assessments and enter scores."
      quickActions={[
        {
          href: "/academics",
          title: "Academics",
          icon: "academics",
        },
        {
          href: "/attendance",
          title: "Attendance",
          icon: "attendance",
        },
        ...(canManageStructure
          ? [
              {
                href: "/academic-structure",
                title: "Academic structure",
                icon: "settings" as const,
              },
            ]
          : []),
      ]}
      attentionItems={[]}
      mainTitle="Gradebooks"
    >
      <GradebookMvpClient
        schoolId={currentSchoolId}
        initialSectionId={queryValue(query.sectionId)}
        initialSubjectId={queryValue(query.subjectId)}
        canManageStructure={canManageStructure}
      />
    </SchoolModuleWorkspace>
  );
}
