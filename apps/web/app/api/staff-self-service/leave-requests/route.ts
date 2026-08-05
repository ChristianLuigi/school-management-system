import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/staff-self-service/leave-requests?schoolId=${encodeURIComponent(schoolId)}`,
  });
}

export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "POST",
    path: "/staff-self-service/leave-requests",
  });
}
