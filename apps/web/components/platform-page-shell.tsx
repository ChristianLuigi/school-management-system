import { redirect } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell";
import { getMeContext } from "@/lib/server-context";

type PlatformPageShellProps = {
  children: React.ReactNode;
};

export async function PlatformPageShell({
  children,
}: PlatformPageShellProps) {
  const context = await getMeContext();

  if (!context.isSuperAdmin) {
    redirect("/school");
  }

  return <PlatformShell>{children}</PlatformShell>;
}