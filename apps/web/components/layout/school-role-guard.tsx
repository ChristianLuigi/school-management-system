import { redirect } from "next/navigation";
import {
  getMeContext,
  resolveEffectiveRoles,
} from "@/lib/server-context";

export async function SchoolRoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const context = await getMeContext();
  const roles = resolveEffectiveRoles(context);

  if (!allowedRoles.some((role) => roles.includes(role))) {
    redirect("/school");
  }

  return children;
}
