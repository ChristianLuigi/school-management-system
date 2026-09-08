import { AttendanceSessionClient } from "@/components/attendance-session-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
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
  const roles = resolveEffectiveRoles(context);
  const canManageStructure = roles.includes("SCHOOL_ADMIN");
  const slot = queryValue(query.slot);

  return (
    <SchoolModuleWorkspace
      compact
      title="Attendance"
      description="Record the daily class register."
      quickActions={[
        {
          href: "/academics",
          title: "Academics",
          icon: "academics",
        },
        {
          href: "/gradebooks",
          title: "Gradebooks",
          icon: "gradebooks",
        },
        ...(canManageStructure
          ? [
              {
                href: "/students",
                title: "Students",
                icon: "students" as const,
              },
            ]
          : []),
      ]}
      attentionItems={[]}
      mainTitle="Attendance"
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
