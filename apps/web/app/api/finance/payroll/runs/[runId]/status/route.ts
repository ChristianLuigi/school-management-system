import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path: `/finance/payroll/runs/${encodeURIComponent(runId)}/status`,
  });
}
