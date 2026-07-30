import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

type RouteContext = {
  params: Promise<{ staffId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { staffId } = await params;
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}` +
      request.nextUrl.search,
  });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { staffId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path: `/staff-management/staff/${encodeURIComponent(staffId)}`,
  });
}
