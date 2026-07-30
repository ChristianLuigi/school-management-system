import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ correctionId: string }> },
) {
  const { correctionId } = await context.params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/payment-corrections/${encodeURIComponent(correctionId)}` +
      "/approve",
  });
}

