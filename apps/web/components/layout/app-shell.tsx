"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export type NavigationIcon =
  | "academics"
  | "activity"
  | "admissions"
  | "attendance"
  | "dashboard"
  | "demo"
  | "finance"
  | "gradebooks"
  | "reports"
  | "schools"
  | "settings"
  | "students";

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIcon;
  exact?: boolean;
};

type AppShellProps = {
  children: ReactNode;
  navigation: NavigationItem[];
  workspaceLabel: string;
  workspaceName: string;
  workspaceCode?: string;
  user: {
    name: string;
    email: string;
  };
  actions?: ReactNode;
  notice?: ReactNode;
};

export function AppShell({
  children,
  navigation,
  workspaceLabel,
  workspaceName,
  workspaceCode,
  user,
  actions,
  notice,
}: AppShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/session/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <Sidebar
        items={navigation}
        open={sidebarOpen}
        workspaceLabel={workspaceLabel}
        workspaceName={workspaceName}
        workspaceCode={workspaceCode}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="min-h-svh lg:pl-72 print:pl-0">
        <Topbar
          workspaceLabel={workspaceLabel}
          user={user}
          actions={actions}
          loggingOut={loggingOut}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <main id="main-content" tabIndex={-1} className="outline-none">
          <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 print:p-0">
            {notice}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
