import { AttendanceSessionClient } from "@/components/attendance-session-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function AttendancePage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
      <SchoolModuleWorkspace
        title="Attendance"
        description="Take morning and afternoon attendance by class/section."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/academic-structure",
            title: "Classes & Sections",
            description: "Configure classes before taking attendance.",
          },
          {
            href: "/students",
            title: "Students",
            description: "Assign students to classes and sections.",
          },
        ]}
        attentionItems={[
          {
            tone: "blue",
            title: "Attendance MVP",
            description:
              "This version records daily attendance by class, date, and morning/afternoon slot.",
          },
        ]}
        mainTitle="Class Attendance"
        mainSubtitle="Select a class, date, and slot, then submit attendance."
      >
        <AttendanceSessionClient schoolId={currentSchoolId} />
      </SchoolModuleWorkspace>
  );
}
