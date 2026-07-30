import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/finance/payroll/runs/${encodeURIComponent(runId)}/payment-register` +
      request.nextUrl.search,
  });
}
