import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/reconciliation/periods/` +
      `${encodeURIComponent(periodId)}/reopen`,
  });
}
