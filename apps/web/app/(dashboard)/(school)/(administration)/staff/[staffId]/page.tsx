import { StaffDetailClient } from "@/components/staff-detail-client";
import { getMeContext, resolveCurrentSchoolId } from "@/lib/server-context";

export default async function StaffDetailsPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const context = await getMeContext();
  const schoolId = resolveCurrentSchoolId(context);
  const { staffId } = await params;

  return <StaffDetailClient schoolId={schoolId} staffId={staffId} />;
}
