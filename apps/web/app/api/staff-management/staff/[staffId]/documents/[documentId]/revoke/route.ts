import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ staffId: string; documentId: string }>;
  },
) {
  const { staffId, documentId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}` +
      `/documents/${encodeURIComponent(documentId)}/revoke`,
  });
}
