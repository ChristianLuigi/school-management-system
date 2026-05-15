"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Settings,
  Users,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

type SchoolShellProps = {
  children: ReactNode;
  headerExtra?: ReactNode;
  currentRoles: string[];
  schoolName?: string;
  schoolCode?: string;
};

const navItems = [
  {
    href: "/school",
    label: "Dashboard",
    icon: Home,
    roles: ["SCHOOL_ADMIN", "TEACHER", "FINANCE_ADMIN"],
  },
  {
    href: "/setup",
    label: "Setup",
    icon: Settings,
    roles: ["SCHOOL_ADMIN"],
  },
  {
    href: "/students",
    label: "Students",
    icon: Users,
    roles: ["SCHOOL_ADMIN"],
  },
  {
    href: "/admissions",
    label: "Admissions",
    icon: FileText,
    roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN", "TEACHER"],
  },
  {
    href: "/academics",
    label: "Academics",
    icon: GraduationCap,
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/gradebooks",
    label: "Gradebooks",
    icon: ClipboardList,
    roles: ["SCHOOL_ADMIN", "TEACHER"],
  },
  {
    href: "/finance",
    label: "Finance",
    icon: CreditCard,
    roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BookOpen,
    roles: ["SCHOOL_ADMIN", "FINANCE_ADMIN"],
  },
];

export function AdminShell({
  children,
  headerExtra,
  currentRoles,
  schoolName,
  schoolCode,
}: SchoolShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const visibleNavItems = useMemo(() => {
    return navItems.filter((item) =>
      item.roles.some((role) => currentRoles.includes(role)),
    );
  }, [currentRoles]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/session/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              School Workspace
            </div>
            <div className="mt-1 text-xl font-bold text-slate-900">
              {schoolName ?? "School"}
            </div>
            {schoolCode ? (
              <div className="mt-1 text-sm text-slate-500">{schoolCode}</div>
            ) : null}
          </div>

          <nav className="flex flex-col gap-1 p-4">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Internal Operations
              </div>
              <div className="text-lg font-semibold">School Workspace</div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {headerExtra}

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <LogOut size={16} />
                {loggingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </header>

          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
