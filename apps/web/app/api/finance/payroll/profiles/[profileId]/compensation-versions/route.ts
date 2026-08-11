import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;
  return proxyAuthenticated(request, {
    method: "GET",
    path:
      `/finance/payroll/profiles/${encodeURIComponent(profileId)}` +
      `/compensation-versions${request.nextUrl.search}`,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;
  return proxyAuthenticated(request, {
    method: "POST",
    path:
      `/finance/payroll/profiles/${encodeURIComponent(profileId)}` +
      "/compensation-versions",
  });
}
