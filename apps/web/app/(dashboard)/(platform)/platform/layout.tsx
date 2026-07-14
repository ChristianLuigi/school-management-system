import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getServerTranslator } from "@/lib/i18n";
import { getPlatformNavigation } from "@/lib/navigation";
import { getMeContext } from "@/lib/server-context";

export default async function PlatformWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getMeContext();

  if (!context.isSuperAdmin) {
    redirect("/school");
  }

  const userName = [context.user.firstName, context.user.lastName]
    .filter(Boolean)
    .join(" ");
  const { locale } = await getServerTranslator();

  return (
    <AppShell
      navigation={getPlatformNavigation(locale)}
      workspaceLabel="Platform workspace"
      workspaceName="Super Admin"
      user={{ name: userName, email: context.user.email }}
      actions={<LanguageSwitcher />}
    >
      {children}
    </AppShell>
  );
}