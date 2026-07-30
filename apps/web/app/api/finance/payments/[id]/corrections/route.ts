import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return proxyAuthenticated(request, {
    method: "POST",
    path: `/finance/payments/${encodeURIComponent(id)}/corrections`,
  });
}


