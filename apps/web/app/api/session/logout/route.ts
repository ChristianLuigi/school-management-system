import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: AUTH_SCHOOL_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 0,
  });

  return response;
}