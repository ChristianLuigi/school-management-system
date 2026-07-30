import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/finance/payments/[id]/receipt-prints">,
) {
  const { id } = await context.params;
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/finance/payments/${encodeURIComponent(id)}/receipt-prints` +
      request.nextUrl.search,
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/finance/payments/[id]/receipt-prints">,
) {
  const { id } = await context.params;
  return proxyAuthenticated(request, {
    method: "POST",
    path: `/finance/payments/${encodeURIComponent(id)}/receipt-prints`,
  });
}
