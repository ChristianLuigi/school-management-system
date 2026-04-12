import { NextRequest, NextResponse } from "next/server";

const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const schoolId =
    typeof body?.schoolId === "string" ? body.schoolId.trim() : "";

  const response = NextResponse.json({ ok: true, schoolId });

  response.cookies.set({
    name: AUTH_SCHOOL_COOKIE_NAME,
    value: schoolId,
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}