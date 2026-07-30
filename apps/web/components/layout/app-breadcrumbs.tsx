"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, CornerUpLeft } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type BreadcrumbNavigationItem = {
  href: string;
  label: string;
};

type BreadcrumbItem = {
  href: string;
  label: string;
};

const ROUTE_LABELS = {
  en: {
    actions: "Actions",
    activity: "Activity",
    billing: "Billing plans",
    cashier: "Cashier",
    corrections: "Corrections",
    edit: "Edit",
    invite: "Invitation",
    invoices: "Invoices",
    onboarding: "Onboarding",
    payslip: "Payslip",
    print: "Print",
    payroll: "Payroll",
    receipt: "Receipt",
    reconciliation: "Deposits and period close",
    "registration-receipt": "Registration receipt",
    "decision-letter": "Decision letter",
    "report-card": "Report card",
    schools: "Schools",
    statement: "Financial statement",
    thermal: "Thermal print",
  },
  fr: {
    actions: "Actions",
    activity: "Activité",
    billing: "Plans de facturation",
    cashier: "Caisse",
    corrections: "Corrections",
    edit: "Modifier",
    invite: "Invitation",
    invoices: "Factures",
    onboarding: "Intégration",
    payslip: "Bulletin de paie",
    print: "Imprimer",
    payroll: "Paie",
    receipt: "Reçu",
    reconciliation: "Dépôts et clôture",
    "registration-receipt": "Reçu d’inscription",
    "decision-letter": "Lettre de décision",
    "report-card": "Bulletin",
    schools: "Écoles",
    statement: "Relevé financier",
    thermal: "Impression thermique",
  },
} as const;

const DYNAMIC_LABELS = {
  en: {
    admissions: "Application",
    batches: "Report batch",
    cards: "Report card",
    invoices: "Invoice details",
    items: "Payroll item",
    payments: "Payment details",
    runs: "Payroll run",
    schools: "School details",
    students: "Student profile",
    fallback: "Details",
  },
  fr: {
    admissions: "Demande",
    batches: "Lot de bulletins",
    cards: "Bulletin",
    invoices: "Détails de la facture",
    items: "Élément de paie",
    payments: "Détails du paiement",
    runs: "Cycle de paie",
    schools: "Détails de l’école",
    students: "Profil de l’élève",
    fallback: "Détails",
  },
} as const;

const NON_LINKABLE_DYNAMIC_PARENTS = new Set([
  "batches",
  "items",
  "payments",
]);
const STRUCTURAL_SEGMENTS = new Set([
  "batches",
  "cards",
  "invoices",
  "items",
  "payments",
  "runs",
]);

function normalizePath(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function isDynamicSegment(segment: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
    /^[0-9]+$/.test(segment)
  );
}

function dynamicLabel(
  locale: "fr" | "en",
  previousSegment: string | undefined,
) {
  const labels = DYNAMIC_LABELS[locale];
  if (!previousSegment) return labels.fallback;
  return labels[previousSegment as keyof typeof labels] ?? labels.fallback;
}

function segmentLabel(locale: "fr" | "en", segment: string) {
  const labels = ROUTE_LABELS[locale];
  const known = labels[segment as keyof typeof labels];
  if (known) return known;

  return decodeURIComponent(segment)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function breadcrumbItems(
  pathname: string,
  navigation: BreadcrumbNavigationItem[],
  locale: "fr" | "en",
) {
  const currentPath = normalizePath(pathname);
  const root = [...navigation]
    .sort((left, right) => right.href.length - left.href.length)
    .find(
      (item) =>
        currentPath === item.href || currentPath.startsWith(`${item.href}/`),
    );

  if (!root || currentPath === root.href) return [];

  const remainingSegments = currentPath
    .slice(root.href.length)
    .split("/")
    .filter(Boolean);
  const items: BreadcrumbItem[] = [{ href: root.href, label: root.label }];
  let cumulativePath = root.href;

  for (let index = 0; index < remainingSegments.length; index += 1) {
    const segment = remainingSegments[index];
    const previousSegment =
      index > 0
        ? remainingSegments[index - 1]
        : root.href.split("/").filter(Boolean).at(-1);
    cumulativePath += `/${segment}`;

    if (STRUCTURAL_SEGMENTS.has(segment)) continue;

    const dynamic = isDynamicSegment(segment);
    const hasFollowingSegment = index < remainingSegments.length - 1;
    if (
      dynamic &&
      hasFollowingSegment &&
      previousSegment &&
      NON_LINKABLE_DYNAMIC_PARENTS.has(previousSegment)
    ) {
      continue;
    }

    const href =
      dynamic && previousSegment === "students" && root.href === "/finance"
        ? `/students/${segment}`
        : cumulativePath;

    items.push({
      href,
      label: dynamic
        ? dynamicLabel(locale, previousSegment)
        : segmentLabel(locale, segment),
    });
  }

  return items;
}

export function AppBreadcrumbs({
  navigation,
}: {
  navigation: BreadcrumbNavigationItem[];
}) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const items = breadcrumbItems(pathname, navigation, locale);

  if (!items.length) return null;

  return (
    <nav
      aria-label={locale === "fr" ? "Fil d’Ariane" : "Breadcrumb"}
      className="mb-5 border-b border-border pb-3 print:hidden"
    >
      <ol className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1;

          return (
            <li key={item.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                  size={15}
                />
              ) : null}
              {current ? (
                <span
                  aria-current="page"
                  className="max-w-72 truncate font-medium text-foreground"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex max-w-64 items-center gap-1.5 truncate font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                  title={item.label}
                >
                  {index === 0 ? (
                    <CornerUpLeft
                      aria-hidden="true"
                      className="shrink-0"
                      size={15}
                    />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
