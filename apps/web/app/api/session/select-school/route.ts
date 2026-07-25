import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;

  if (!request.cookies.get(getSessionCookieName())?.value) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const schoolId =
    body &&
    typeof body === "object" &&
    "schoolId" in body &&
    typeof body.schoolId === "string"
      ? body.schoolId.trim()
      : "";

  if (!UUID_PATTERN.test(schoolId)) {
    return NextResponse.json(
      { message: "A valid schoolId is required." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true, schoolId });
  response.cookies.set({
    name: AUTH_SCHOOL_COOKIE_NAME,
    value: schoolId,
    ...getSessionCookieOptions(),
    maxAge: 60 * 60 * 8,
  });
  return response;
}