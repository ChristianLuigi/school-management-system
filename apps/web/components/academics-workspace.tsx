import { ReactNode } from "react";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";

export function AcademicsWorkspace({
  currentRoles,
  children,
}: {
  currentRoles: string[];
  children: ReactNode;
}) {
  const isSchoolAdmin = currentRoles.includes("SCHOOL_ADMIN");
  const isTeacher = currentRoles.includes("TEACHER");

  const quickActions = [
    {
      href: "/academics",
      title: "Academic Structure",
      description: "Review school levels, grade levels, sections, and subjects.",
    },
    {
      href: "/attendance",
      title: "Attendance",
      description: "Move from class structure into daily attendance operations.",
    },
    {
      href: "/gradebooks",
      title: "Gradebooks",
      description: "Review assessment and scoring workflows by academic context.",
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/setup",
      title: "School Setup",
      description: "Review the academic setup and structural readiness.",
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "blue" as const,
      title: "Academic structure drives the whole school workflow",
      description:
        "Sections, subjects, grade levels, and grading periods must be correct before attendance and gradebook operations become reliable.",
    },
    {
      tone: "amber" as const,
      title: "Check teacher-subject assignments",
      description:
        "A teacher should only see the classes and subjects that belong to their real assignment.",
    },
  ];

  if (isTeacher) {
    attentionItems.push({
      tone: "green" as const,
      title: "Teacher priority",
      description:
        "Use this area to confirm your assigned academic context before taking attendance or managing gradebooks.",
    });
  }

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber" as const,
      title: "Admin priority",
      description:
        "Validate the structure before publishing grades, generating report cards, or starting a new term.",
    });
  }

  return (
    <SchoolModuleWorkspace
      title="Academics Workspace"
      description="Review and manage the school's academic structure and teaching organization."
      roles={currentRoles}
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Academic Operations"
      mainSubtitle="Use the area below to review levels, grade levels, sections, subjects, and academic organization."
    >
      {children}
    </SchoolModuleWorkspace>
  );
}

