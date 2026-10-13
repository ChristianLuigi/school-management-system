"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
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
  desktopVisible: boolean;
  workspaceLabel: string;
  workspaceName: string;
  workspaceCode?: string;
  onClose: () => void;
};

export function Sidebar({
  items,
  open,
  desktopVisible,
  workspaceLabel,
  workspaceName,
  workspaceCode,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const media = window.matchMedia("(min-width: 1024px)");
    let release = () => {};
    function update() {
      release();
      const mobile = !media.matches;
      sidebar!.inert = mobile ? !open : !desktopVisible;
      if (!mobile || !open) return;
      const previousFocus = document.activeElement as HTMLElement | null;
      const content = document.getElementById("workspace-content");
      const wasInert = content?.inert ?? false;
      const previousOverflow = document.body.style.overflow;
      if (content) content.inert = true;
      document.body.style.overflow = "hidden";
      sidebar!.setAttribute("role", "dialog");
      sidebar!.setAttribute("aria-modal", "true");
      const focusable = () =>
        Array.from(
          sidebar!.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex="0"]',
          ),
        ).filter((element) => element.offsetParent !== null);
      focusable()[0]?.focus();
      function keydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
        if (event.key !== "Tab") return;
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first || !last) return;
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !sidebar!.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !sidebar!.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
      document.addEventListener("keydown", keydown);
      release = () => {
        document.removeEventListener("keydown", keydown);
        if (content) content.inert = wasInert;
        document.body.style.overflow = previousOverflow;
        sidebar!.removeAttribute("role");
        sidebar!.removeAttribute("aria-modal");
        previousFocus?.focus();
        release = () => {};
      };
    }
    update();
    media.addEventListener("change", update);
    return () => {
      release();
      media.removeEventListener("change", update);
      sidebar.inert = false;
    };
  }, [open, desktopVisible, onClose]);

  return (
    <aside
      ref={sidebarRef}
      id="app-sidebar"
      aria-label={
        locale === "fr" ? "Navigation principale" : "Primary navigation"
      }
      className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ${desktopVisible ? "lg:visible lg:translate-x-0" : "lg:invisible lg:-translate-x-full"} ${
        open
          ? "visible translate-x-0"
          : "invisible -translate-x-full"
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
          aria-label={
            locale === "fr" ? "Fermer la navigation" : "Close navigation"
          }
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
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
