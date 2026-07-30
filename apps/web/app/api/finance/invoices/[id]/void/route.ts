import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path: `/finance/invoices/${encodeURIComponent(id)}/void`,
  });
}
