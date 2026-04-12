import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${API_BASE_URL}/internal-auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return NextResponse.json(
        { message: data?.message ?? "Login failed." },
        { status: res.status },
      );
    }

    const response = NextResponse.json({
      ok: true,
      user: data.user,
      schools: data.schools,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: data.token,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    const firstSchoolId =
      Array.isArray(data.schools) && data.schools.length === 1
        ? data.schools[0].school_id
        : "";

    response.cookies.set({
      name: AUTH_SCHOOL_COOKIE_NAME,
      value: firstSchoolId,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Login route crashed.",
      },
      { status: 500 },
    );
  }
}