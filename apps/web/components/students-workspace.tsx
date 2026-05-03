import { ReactNode } from "react";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";

export function StudentsWorkspace({
  currentRoles,
  children,
}: {
  currentRoles: string[];
  children: ReactNode;
}) {
  const quickActions = [
    {
      href: "/students",
      title: "Student Directory",
      description: "Review, search, and manage student records.",
    },
    {
      href: "/academics",
      title: "Academic Structure",
      description: "Check grade levels, sections, and class organization.",
    },
    {
      href: "/attendance",
      title: "Attendance",
      description: "Review attendance context connected to student records.",
    },
    {
      href: "/finance",
      title: "Finance",
      description: "Review billing visibility for student-related operations.",
    },
  ];

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "blue" as const,
      title: "Student records are the base of the system",
      description:
        "Keep student identity, section assignment, guardian contacts, and enrollment data clean before using attendance, finance, or gradebooks.",
    },
    {
      tone: "amber" as const,
      title: "Avoid duplicate student profiles",
      description:
        "Before creating a new student, search by name, code, and guardian contact to reduce duplicate records.",
    },
    {
      tone: "green" as const,
      title: "School admin priority",
      description:
        "Use this workspace to maintain accurate student records before operational modules depend on them.",
    },
  ];

  return (
    <SchoolModuleWorkspace
      title="Students Workspace"
      description="Manage student records, enrollment context, and operational student data."
      roles={currentRoles}
      quickActions={quickActions}
      attentionItems={attentionItems}
      mainTitle="Student Operations"
      mainSubtitle="Use the area below to manage and review students for the active school."
    >
      {children}
    </SchoolModuleWorkspace>
  );
}

