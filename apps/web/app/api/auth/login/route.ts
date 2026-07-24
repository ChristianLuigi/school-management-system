import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, getSessionCookieOptions } from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;
  const upstream = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: await request.text(), cache: "no-store",
  });
  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const payload = body?.response ?? body;
    return NextResponse.json({
      code: payload?.code ?? "AUTHENTICATION_FAILED",
      message: payload?.message ?? "Email or password is incorrect.",
    }, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
  }
  if (typeof body?.sessionToken !== "string" || typeof body?.session?.expiresAt !== "string") {
    return NextResponse.json({ message: "Authentication service returned an invalid response." }, { status: 502 });
  }
  const response = NextResponse.json({
    authenticated: true, user: body.user, expiresAt: body.session.expiresAt,
  }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(
    getSessionCookieName(), body.sessionToken,
    getSessionCookieOptions(new Date(body.session.expiresAt)),
  );
  return response;
}
