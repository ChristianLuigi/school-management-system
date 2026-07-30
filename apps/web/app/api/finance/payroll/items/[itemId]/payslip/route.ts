import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/finance/payroll/items/${encodeURIComponent(itemId)}/payslip` +
      request.nextUrl.search,
  });
}