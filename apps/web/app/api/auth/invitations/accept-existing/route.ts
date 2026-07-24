import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getSessionCookieOptions } from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  const upstream = await fetch(`${API_BASE_URL}/auth/invitations/accept-existing`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: await request.text(), cache: "no-store",
  });
  const response = new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
  if (upstream.ok) {
    response.cookies.set(getSessionCookieName(), "", {
      ...getSessionCookieOptions(), expires: new Date(0), maxAge: 0,
    });
  }
  return response;
}
