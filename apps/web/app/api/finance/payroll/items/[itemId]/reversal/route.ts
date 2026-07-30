import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path: `/finance/payroll/items/${encodeURIComponent(itemId)}/reversal`,
  });
}
