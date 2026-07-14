"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Presentation,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type {
  NavigationIcon,
  NavigationItem,
} from "@/components/layout/app-shell";

const icons: Record<NavigationIcon, LucideIcon> = {
  academics: GraduationCap,
  activity: Activity,
  admissions: FileText,
  attendance: ClipboardCheck,
  dashboard: LayoutDashboard,
  demo: Presentation,
  finance: CreditCard,
  gradebooks: ClipboardList,
  reports: BookOpen,
  schools: Building2,
  settings: Settings,
  students: Users,
};

type SidebarProps = {
  items: NavigationItem[];
  open: boolean;
  workspaceLabel: string;
  workspaceName: string;
  workspaceCode?: string;
  onClose: () => void;
};

export function Sidebar({
  items,
  open,
  workspaceLabel,
  workspaceName,
  workspaceCode,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      id="app-sidebar"
      aria-label="Primary navigation"
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex min-h-20 items-center justify-between gap-3 border-b border-sidebar-border px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
            {workspaceLabel}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-sidebar-foreground">
            {workspaceName}
          </p>
          {workspaceCode ? (
            <p className="mt-0.5 truncate text-xs text-sidebar-muted">
              {workspaceCode}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Close navigation"
          className="rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          onClick={onClose}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              onClick={onClose}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
