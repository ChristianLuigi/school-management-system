import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bankAccountId: string }> },
) {
  const { bankAccountId } = await params;
  return proxyAuthenticated(request, {
    method: "PATCH",
    path:
      `/finance/reconciliation/bank-accounts/` +
      `${encodeURIComponent(bankAccountId)}/status`,
  });
}
