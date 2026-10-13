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

function colorForeground(color: string) {
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? "#000000" : "#ffffff";
}

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
  const { theme, setTheme } = useTheme();
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
  const appearanceStyle = currentAppearance ? {
    "--primary": currentAppearance.primaryColor,
    "--primary-hover": currentAppearance.primaryColor,
    "--primary-foreground": colorForeground(currentAppearance.primaryColor),
    "--accent": currentAppearance.accentColor,
    "--accent-foreground": colorForeground(currentAppearance.accentColor),
    "--ring": currentAppearance.primaryColor,
  } as CSSProperties : undefined;
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
    <div className="min-h-svh bg-background text-foreground" style={appearanceStyle}>
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
            {schoolId && userId ? <details className="mb-4 text-sm">
              <summary className="cursor-pointer">{locale === "fr" ? "Apparence personnelle" : "Personal appearance"}</summary>
              <label className="mt-2 flex items-center gap-3">
                {locale === "fr" ? "Thème (ce navigateur)" : "Theme (this browser)"}
                <select value={theme} className="rounded border border-border bg-surface p-2" onChange={event => {
                  if (!isTheme(event.target.value)) return;
                  try { localStorage.setItem(`almac:appearance:${userId}`, event.target.value); } catch { /* Optional storage. */ }
                  setTheme(event.target.value, false);
                }}>
                  <option value="light">{locale === "fr" ? "Clair" : "Light"}</option>
                  <option value="dark">{locale === "fr" ? "Sombre" : "Dark"}</option>
                  <option value="system">{locale === "fr" ? "Système" : "System"}</option>
                </select>
              </label>
            </details> : null}
            {currentAppearance?.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={currentAppearance.logoUrl} alt={workspaceName} className="mb-4 h-12 max-w-48 object-contain" />
            ) : null}
            {logoutError ? (
              <p
                role="alert"
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
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
