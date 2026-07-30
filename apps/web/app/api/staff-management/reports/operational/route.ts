import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  const credentialWindowDays =
    request.nextUrl.searchParams.get("credentialWindowDays") ?? "60";
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/staff-management/reports/operational` +
      `?schoolId=${encodeURIComponent(schoolId)}` +
      `&credentialWindowDays=${encodeURIComponent(credentialWindowDays)}`,
  });
}
