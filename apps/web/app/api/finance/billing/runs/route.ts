import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/finance/billing/runs${request.nextUrl.search}`,
  });
}

export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "POST",
    path: "/finance/billing/runs",
  });
}
