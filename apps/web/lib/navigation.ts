import type { NavigationItem } from "@/components/layout/app-shell";
import { translate, type Locale } from "@/lib/i18n/messages";

type SchoolNavigationItem = Omit<NavigationItem, "label"> & {
  labelKey: string;
  roles: string[];
};

const schoolNavigation: SchoolNavigationItem[] = [
  {
    href: "/school",
    labelKey: "nav.dashboard",
    icon: "dashboard",
    exact: true,
    roles: ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"],
  },
  {
    href: "/demo",
    labelKey: "nav.demo",
    icon: "demo",
    roles: ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"],
  },
  {
    href: "/students",
    labelKey: "nav.students",
    icon: "students",
    roles: ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"],
  },
  {
    href: "/admissions",
    labelKey: "nav.admissions",
    icon: "admissions",
    roles: ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"],
  },
  {
    href: "/academics",
    labelKey: "nav.academics",
    icon: "academics",
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/attendance",
    labelKey: "nav.attendance",
    icon: "attendance",
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/gradebooks",
    labelKey: "nav.gradebooks",
    icon: "gradebooks",
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/finance",
    labelKey: "nav.finance",
    icon: "finance",
    roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN"],
  },
  {
    href: "/reports",
    labelKey: "nav.reports",
    icon: "reports",
    roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN"],
  },
  {
    href: "/users",
    labelKey: "nav.users",
    icon: "students",
    roles: ["SCHOOL_ADMIN"],
  },
  {
    href: "/setup",
    labelKey: "nav.settings",
    icon: "settings",
    roles: ["SCHOOL_ADMIN"],
  },
];

const platformNavigationItems: Array<Omit<NavigationItem, "label"> & {
  labelKey: string;
}> = [
  { href: "/platform", labelKey: "nav.dashboard", icon: "dashboard", exact: true },
  { href: "/platform/schools", labelKey: "nav.schools", icon: "schools" },
  { href: "/platform/staff", labelKey: "nav.staff", icon: "students" },
  { href: "/platform/onboarding", labelKey: "nav.onboarding", icon: "settings" },
  { href: "/platform/activity", labelKey: "nav.activity", icon: "activity" },
  { href: "/platform/reports", labelKey: "nav.reports", icon: "reports" },
];

export function getSchoolNavigation(
  roles: string[],
  locale: Locale,
): NavigationItem[] {
  return schoolNavigation
    .filter((item) => item.roles.some((role) => roles.includes(role)))
    .map(({ href, labelKey, icon, exact }) => ({
      href,
      label: translate(locale, labelKey),
      icon,
      exact,
    }));
}

export function getPlatformNavigation(locale: Locale): NavigationItem[] {
  return platformNavigationItems.map(({ href, labelKey, icon, exact }) => ({
    href,
    label: translate(locale, labelKey),
    icon,
    exact,
  }));
}