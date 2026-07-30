import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path: `/finance/billing/plans/${encodeURIComponent(planId)}/status`,
  });
}
