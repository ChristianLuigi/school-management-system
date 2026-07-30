import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/finance/payroll/runs${request.nextUrl.search}`,
  });
}

export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "POST",
    path: "/finance/payroll/runs",
  });
}
