import { NextRequest, NextResponse } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

const ACTIONS = new Set(["approve", "reject", "cancel"]);

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ leaveRequestId: string; action: string }>;
  },
) {
  const { leaveRequestId, action } = await params;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { message: "Unsupported leave action." },
      { status: 404 },
    );
  }
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/staff-management/leave-requests/` +
      `${encodeURIComponent(leaveRequestId)}/${action}`,
  });
}
