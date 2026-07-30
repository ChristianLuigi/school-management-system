import { redirect } from "next/navigation";
import { getMeContext, hasSchoolRole } from "@/lib/server-context";

export default async function PayrollApprovalsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const context = await getMeContext();

  if (!hasSchoolRole(context, "SCHOOL_ADMIN")) {
    redirect("/finance/payroll");
  }

  return children;
}