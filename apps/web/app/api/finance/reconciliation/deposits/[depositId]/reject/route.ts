import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ depositId: string }> },
) {
  const { depositId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/reconciliation/deposits/` +
      `${encodeURIComponent(depositId)}/reject`,
  });
}
