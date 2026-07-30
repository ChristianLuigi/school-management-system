import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/finance/payroll/staff-options${request.nextUrl.search}`,
  });
}
