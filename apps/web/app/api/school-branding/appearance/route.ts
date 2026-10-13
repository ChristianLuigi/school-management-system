import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";
export function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  return proxyAuthenticated(request, { method: "GET", path: `/school-branding/appearance?schoolId=${encodeURIComponent(schoolId)}` });
}
