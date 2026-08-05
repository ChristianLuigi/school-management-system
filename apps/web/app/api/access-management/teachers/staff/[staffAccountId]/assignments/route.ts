import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ staffAccountId: string }>;
  },
) {
  const { staffAccountId } = await params;
  return proxyAuthenticated(request, {
    method: "PUT",
    path:
      "/access-management/teachers/staff/" +
      `${encodeURIComponent(staffAccountId)}/assignments`,
  });
}
