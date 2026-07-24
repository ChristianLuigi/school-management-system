import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getSessionCookieOptions } from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;
  const cookieName = getSessionCookieName();
  const token = request.cookies.get(cookieName)?.value;
  if (token) {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    }).catch(() => null);
  }
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(cookieName, "", { ...getSessionCookieOptions(), expires: new Date(0), maxAge: 0 });
  response.cookies.set("school_current_id", "", { ...getSessionCookieOptions(), expires: new Date(0), maxAge: 0 });
  return response;
}
