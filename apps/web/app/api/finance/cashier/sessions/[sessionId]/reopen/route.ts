import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  context: RouteContext<
    "/api/finance/cashier/sessions/[sessionId]/reopen"
  >,
) {
  const { sessionId } = await context.params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/cashier/sessions/${encodeURIComponent(sessionId)}/reopen`,
  });
}
