import Link from "next/link";
import { SchoolModuleWorkspace } from "@/components/school-module-workspace";
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

const DEMO_DATA_CHECKLIST = [
  {
    title: "Academic structure",
    items: [
      "Maternelle division exists",
      "Primaire division exists",
      "1re Ann\u00e9e - Section A exists",
      "Subjects assigned to 1re Ann\u00e9e with coefficients",
    ],
  },
  {
    title: "Student file",
    items: [
      "Student Marc Jean Baptiste exists",
      "Student has guardian Marie Baptiste",
      "Student assigned to 1re Ann\u00e9e - A",
      "Student status is Active",
    ],
  },
  {
    title: "Finance",
    items: [
      "Invoice created for the student",
      "Partial payment recorded",
      "A4 invoice opens",
      "80mm receipt opens",
    ],
  },
  {
    title: "Attendance",
    items: [
      "Morning attendance submitted for 1re Ann\u00e9e - A",
      "Student attendance history is visible",
      "Attendance dashboard shows the submitted session",
    ],
  },
  {
    title: "Gradebook",
    items: [
      "Math\u00e9matiques assessment created",
      "Student score entered",
      "Report card shows the weighted average",
    ],
  },
  {
    title: "Payroll",
    items: [
      "Payroll staff profile created",
      "Payroll run generated",
      "Salary marked paid",
      "Payslip is printable",
    ],
  },
];

const EMERGENCY_DEMO_LINKS = [
  ["/school", "Dashboard"],
  ["/academic-structure", "Setup"],
  ["/admissions", "Admissions"],
  ["/students", "Students"],
  ["/finance", "Finance"],
  ["/finance/payroll", "Payroll"],
  ["/attendance", "Attendance"],
  ["/gradebooks", "Gradebook"],
];

export default async function DemoPage() {
  const context = await getMeContext();
  const effectiveRoles = resolveEffectiveRoles(context);

  return (
      <SchoolModuleWorkspace
        title="Final Demo"
        description="Client presentation control center."
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">
              Demo Data Checklist
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Check this scenario before presenting to make sure every demo flow
              has connected data.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {DEMO_DATA_CHECKLIST.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <h4 className="font-semibold text-slate-950">
                    {group.title}
                  </h4>
                  <div className="mt-3 space-y-2">
                    {group.items.map((item) => (
                      <label
                        key={item}
                        className="flex items-start gap-2 text-sm leading-6 text-slate-700"
                      >
                        <input
                          type="checkbox"
                          className="mt-1.5 h-4 w-4 rounded border-slate-300"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-950">
              Emergency Demo Links
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Jump directly to any core module during the presentation.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {EMERGENCY_DEMO_LINKS.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {label}
                </Link>
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
  );
}
