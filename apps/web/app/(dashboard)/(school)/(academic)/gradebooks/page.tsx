import { GradebookMvpClient } from "@/components/gradebook-mvp-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function GradebooksPage() {
  const context = await getMeContext();
  const currentSchoolId = resolveCurrentSchoolId(context);

  return (
    <SchoolModuleWorkspace
      title="Gradebooks"
      description="Create assessments and enter student scores."
      quickActions={[
        {
          href: "/academic-structure",
          title: "Classes & Sections",
          description: "Configure academic sections.",
        },
        {
          href: "/students",
          title: "Students",
          description: "Review student academic records.",
        },
      ]}
      attentionItems={[
        {
          tone: "blue",
          title: "Gradebook MVP",
          description:
            "This version supports simple assessment creation and score entry by class/section.",
        },
      ]}
      mainTitle="Gradebook"
      mainSubtitle="Select a class, create assessments, and enter scores."
    >
      <GradebookMvpClient schoolId={currentSchoolId} />
    </SchoolModuleWorkspace>
  );
}
