import { AttendanceSessionClient } from "@/components/attendance-session-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getServerTranslator } from "@/lib/i18n";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

function queryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    sectionId?: string | string[];
    date?: string | string[];
    slot?: string | string[];
  }>;
}) {
  const [context, query] = await Promise.all([getMeContext(), searchParams]);
  const currentSchoolId = resolveCurrentSchoolId(context);
  const { t } = await getServerTranslator();
  const roles = resolveEffectiveRoles(context);
  const canManageStructure = roles.includes("SCHOOL_ADMIN");
  const slot = queryValue(query.slot);

  return (
    <SchoolModuleWorkspace
      compact
      title={t("attendance.title")}
      description={t("attendance.description")}
      quickActions={[
        {
          href: "/academics",
          title: t("nav.academics"),
          icon: "academics",
        },
        {
          href: "/gradebooks",
          title: t("nav.gradebooks"),
          icon: "gradebooks",
        },
        ...(canManageStructure
          ? [
              {
                href: "/students",
                title: t("nav.students"),
                icon: "students" as const,
              },
            ]
          : []),
      ]}
      attentionItems={[]}
      mainTitle={t("attendance.title")}
    >
      <AttendanceSessionClient
        schoolId={currentSchoolId}
        initialSectionId={queryValue(query.sectionId)}
        initialAttendanceDate={queryValue(query.date)}
        initialSlot={slot === "AFTERNOON" ? "AFTERNOON" : "MORNING"}
        canManageStructure={canManageStructure}
      />
    </SchoolModuleWorkspace>
  );
}
