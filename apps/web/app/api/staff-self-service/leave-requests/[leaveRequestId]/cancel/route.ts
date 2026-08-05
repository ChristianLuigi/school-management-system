import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaveRequestId: string }> },
) {
  const { leaveRequestId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/staff-self-service/leave-requests/${encodeURIComponent(
        leaveRequestId,
      )}/cancel`,
  });
}
