import { NextRequest, NextResponse } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

const READ_OPERATIONS = new Set([
  "history",
  "access",
  "assignments",
  "assignment-options",
  "medical",
  "payroll-summary",
]);

const LIFECYCLE_OPERATIONS = new Set([
  "activate",
  "leave",
  "suspend",
  "reactivate",
  "terminate",
  "rehire",
  "archive",
]);

type RouteContext = {
  params: Promise<{
    staffId: string;
    operation: string;
  }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { staffId, operation } = await params;
  if (!READ_OPERATIONS.has(operation)) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}/` +
      `${operation}${request.nextUrl.search}`,
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { staffId, operation } = await params;
  if (!LIFECYCLE_OPERATIONS.has(operation)) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}/` +
      operation,
  });
}
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { staffId, operation } = await params;
  if (operation !== "medical") {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }
  return proxyAuthenticated(request, {
    method: "PATCH",
    path:
      `/staff-management/staff/${encodeURIComponent(staffId)}/` +
      operation,
  });
}