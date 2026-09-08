import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return proxyAuthenticated(request, {
    method: "PATCH",
    path: `/school-students/${encodeURIComponent(id)}/section`,
  });
}
