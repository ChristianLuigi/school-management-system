import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/staff-self-service/documents?schoolId=${encodeURIComponent(schoolId)}`,
  });
}
