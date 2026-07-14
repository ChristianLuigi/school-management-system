import { ReportCardBatchesClient } from "@/components/report-card-batches-client";
import { SchoolBrandingClient } from "@/components/school-branding-client";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import {
  getMeContext,
  resolveCurrentSchoolId,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export default async function ReportsPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);
  const currentSchoolId = resolveCurrentSchoolId(context);

  const isSchoolAdmin = effectiveRoles.includes("SCHOOL_ADMIN");
  const isFinanceAdmin = effectiveRoles.includes("FINANCE_ADMIN");

  const quickActions = [
    {
      href: "/gradebooks",
      title: "Gradebooks",
      description: "Review academic readiness before report card publication.",
    },
    {
      href: "/finance",
      title: "Finance",
      description: "Review financial summaries and operational billing context.",
    },
  ];

  if (isSchoolAdmin) {
    quickActions.push({
      href: "/students",
      title: "Students",
      description: "Review student profiles and enrollment context.",
    });
  }

  const attentionItems: Array<{
    tone: "green" | "amber" | "red" | "blue" | "neutral";
    title: string;
    description: string;
  }> = [
    {
      tone: "blue",
      title: "Reports depend on validated operational data",
      description:
        "Academic reports should be generated only after gradebooks are approved and published.",
    },
  ];

  if (isSchoolAdmin) {
    attentionItems.push({
      tone: "amber",
      title: "School admin priority",
      description:
        "Use this workspace to review generated report card batches before publishing them.",
    });
  }

  if (isFinanceAdmin) {
    attentionItems.push({
      tone: "green",
      title: "Finance admin priority",
      description:
        "Finance reporting will be added here after invoice and payment workflows are hardened.",
    });
  }

  return (
      <SchoolModuleWorkspace
        title="Reports Workspace"
        description="Review generated academic reports and operational report outputs."
        quickActions={quickActions}
        attentionItems={attentionItems}
        mainTitle="Report Operations"
        mainSubtitle="Generated report card batches and report outputs appear below."
      >
        <div className="space-y-6">
          {isSchoolAdmin ? (
            <div className="space-y-6">
              <SchoolBrandingClient schoolId={currentSchoolId} />
              <ReportCardBatchesClient schoolId={currentSchoolId} />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">
                Finance reporting placeholder
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Finance-specific reports will be added after invoice and payment workflows are hardened.
              </p>
            </div>
          )}
        </div>
      </SchoolModuleWorkspace>
  );
}
