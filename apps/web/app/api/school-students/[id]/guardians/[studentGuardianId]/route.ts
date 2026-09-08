import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; studentGuardianId: string }> },
) {
  const { id, studentGuardianId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path:
      `/school-students/${encodeURIComponent(id)}/guardians/` +
      encodeURIComponent(studentGuardianId),
  });
}