import Link from "next/link";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
import { SchoolPageShell } from "@/components/school-page-shell";
import {
  getMeContext,
  resolveEffectiveRoles,
} from "@/lib/server-context";

const DEMO_STEPS = [
  {
    number: "01",
    title: "Academic Setup",
    description:
      "Show academic structure, grade levels, class sections, subjects, and coefficients.",
    href: "/academic-structure",
    action: "Open Setup",
  },
  {
    number: "02",
    title: "Admissions",
    description:
      "Create or review an admission file, validate the applicant, and convert the admission to an official student.",
    href: "/admissions",
    action: "Open Admissions",
  },
  {
    number: "03",
    title: "Student File",
    description:
      "Show identity, guardians, class assignment, status, documents, health notes, finance, attendance, and report card.",
    href: "/students",
    action: "Open Students",
  },
  {
    number: "04",
    title: "Finance",
    description:
      "Create an invoice, record payment, and show invoice, receipt, and 80mm thermal printing.",
    href: "/finance",
    action: "Open Finance",
  },
  {
    number: "05",
    title: "Attendance",
    description:
      "Take attendance by class, date, and morning or afternoon slot, then show student history.",
    href: "/attendance",
    action: "Open Attendance",
  },
  {
    number: "06",
    title: "Gradebook",
    description:
      "Create an assessment using configured subjects, enter scores, and prepare a report card.",
    href: "/gradebooks",
    action: "Open Gradebook",
  },
  {
    number: "07",
    title: "Report Card",
    description:
      "Open a student report card and show the weighted average using subject coefficients.",
    href: "/students",
    action: "Open Students",
  },
  {
    number: "08",
    title: "Payroll Lite",
    description:
      "Show a staff salary profile, generate a payroll run, mark it paid, and print a payslip.",
    href: "/finance/payroll",
    action: "Open Payroll",
  },
];

const DEMO_TALKING_POINTS = [
  "The system is modular, so each school can activate only what it needs.",
  "Academic structure is configurable for kindergarten, primary, secondary, and custom sections.",
  "Administrators control subjects and coefficients by grade level.",
  "The student lifecycle is traceable from admission to active student status.",
  "Finance supports invoices, payments, receipts, and thermal printing.",
  "Attendance is taken by class and session, with individual student history.",
  "Gradebooks and report cards use the school's configured subjects.",
  "Payroll Lite provides a foundation for staff salary tracking.",
];

export default async function DemoPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);

  return (
    <SchoolPageShell
      allowedRoles={["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"]}
    >
      <SchoolModuleWorkspace
        title="Final Demo"
        description="Client presentation control center."
        roles={effectiveRoles}
        quickActions={[
          {
            href: "/school",
            title: "Dashboard",
            description: "Start with the live school overview.",
          },
          {
            href: "/academic-structure",
            title: "Setup",
            description: "Show structure, subjects, and coefficients.",
          },
          {
            href: "/students",
            title: "Students",
            description: "Open the central student file.",
          },
          {
            href: "/finance",
            title: "Finance",
            description: "Show invoices, payments, receipts, and payroll.",
          },
        ]}
        attentionItems={[
          {
            tone: "green",
            title: "Demo flow ready",
            description:
              "Follow this roadmap to present the system in a clean order without jumping randomly between modules.",
          },
        ]}
        mainTitle="Client Demo Roadmap"
        mainSubtitle="Follow this sequence to present the complete school workflow."
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {DEMO_STEPS.map((step) => (
              <Link
                key={step.number}
                href={step.href}
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Step {step.number}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-950">
                  {step.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
                <div className="mt-5 inline-flex w-fit rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition group-hover:bg-slate-700">
                  {step.action}
                </div>
              </Link>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">
              Presentation Talking Points
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {DEMO_TALKING_POINTS.map((point) => (
                <div
                  key={point}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700"
                >
                  <span className="mr-2 font-semibold text-emerald-700">
                    Ready
                  </span>
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="text-lg font-semibold text-amber-950">Demo Rule</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Present unfinished future modules as planned extensions. Focus on
              what works end-to-end today: setup, admissions, students, finance,
              attendance, gradebook, report cards, and payroll lite.
            </p>
          </div>
        </div>
      </SchoolModuleWorkspace>
    </SchoolPageShell>
  );
}
