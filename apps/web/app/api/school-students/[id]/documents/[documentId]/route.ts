import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path:
      `/school-students/${encodeURIComponent(id)}/documents/` +
      encodeURIComponent(documentId),
  });
}