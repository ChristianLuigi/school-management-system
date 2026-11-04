"use client";

import type { ReactNode, CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { isTheme } from "@/lib/theme";
import { useRouter } from "next/navigation";
import { AppBreadcrumbs } from "@/components/layout/app-breadcrumbs";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useI18n } from "@/components/i18n-provider";
import { accessibleBrandColors } from "@/lib/theme-colors";

export type NavigationIcon =
  | "academics"
  | "activity"
  | "admissions"
  | "attendance"
  | "dashboard"
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
  schoolId?: string;
  userId?: string;
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
  schoolId,
  userId,
  user,
  actions,
  notice,
}: AppShellProps) {
  const { locale } = useI18n();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [appearance, setAppearance] = useState<{ schoolId: string; primaryColor: string; accentColor: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/school-branding/appearance?schoolId=${encodeURIComponent(schoolId!)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const body = await response.json();
        if (controller.signal.aborted) return;
        setAppearance({ ...body, schoolId });
        let preference: string | null = null;
        try { preference = localStorage.getItem(`almac:appearance:${userId}`); } catch { /* Optional storage. */ }
        if (isTheme(preference)) setTheme(preference, false);
        else if (isTheme(body.defaultTheme)) setTheme(body.defaultTheme, false);
      } catch { /* Existing default appearance remains available. */ }
    }
    void load();
    window.addEventListener("almac:branding-change", load);
    return () => { controller.abort(); window.removeEventListener("almac:branding-change", load); };
  }, [schoolId, userId, setTheme]);
  const currentAppearance = appearance?.schoolId === schoolId ? appearance : null;
  const appearanceStyle = currentAppearance ? accessibleBrandColors(currentAppearance.primaryColor, currentAppearance.accentColor, resolvedTheme === 'dark') as CSSProperties : undefined;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarVisible, setDesktopSidebarVisible] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/login");
      router.refresh();
    } catch {
      setLogoutError(
        locale === "fr"
          ? "Déconnexion impossible. Vérifiez la connexion et réessayez avec le bouton de déconnexion."
          : "Unable to sign out. Check the connection and try the sign-out button again.",
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div data-application-ui className="min-h-svh bg-background text-foreground" style={appearanceStyle}>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {locale === "fr" ? "Aller au contenu" : "Skip to content"}
      </a>

      {sidebarOpen ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={
            locale === "fr" ? "Fermer la navigation" : "Close navigation"
          }
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={closeSidebar}
        />
      ) : null}

      <Sidebar
        schoolLogoUrl={currentAppearance?.logoUrl}
        desktopVisible={desktopSidebarVisible}
        items={navigation}
        open={sidebarOpen}
        workspaceLabel={workspaceLabel}
        workspaceName={workspaceName}
        workspaceCode={workspaceCode}
        onClose={closeSidebar}
      />

      <div id="workspace-content" className={`min-h-svh ${desktopSidebarVisible ? "lg:pl-72" : ""} print:pl-0`}>
        <Topbar
          schoolLogoUrl={currentAppearance?.logoUrl}
          workspaceLabel={workspaceLabel}
          workspaceName={workspaceName}
          user={user}
          actions={actions}
          loggingOut={loggingOut}
          sidebarOpen={sidebarOpen}
          desktopSidebarVisible={desktopSidebarVisible}
          onDesktopMenuClick={() => setDesktopSidebarVisible(visible => !visible)}
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />

        <main id="main-content" tabIndex={-1} className="outline-none">
          <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8 print:p-0">
            <AppBreadcrumbs navigation={navigation} />
            {logoutError ? (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-danger/40 bg-danger-subtle p-3 text-sm text-danger"
              >
                {logoutError}
              </p>
            ) : null}
            {notice}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
