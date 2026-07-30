import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}` +
      `/leave-requests?schoolId=${encodeURIComponent(schoolId)}`,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ staffId: string }> },
) {
  const { staffId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}` +
      "/leave-requests",
  });
}
