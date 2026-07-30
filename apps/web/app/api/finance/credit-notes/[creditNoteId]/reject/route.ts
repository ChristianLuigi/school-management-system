import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ creditNoteId: string }> },
) {
  const { creditNoteId } = await context.params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/credit-notes/${encodeURIComponent(creditNoteId)}/reject`,
  });
}

