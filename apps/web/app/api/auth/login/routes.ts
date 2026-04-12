import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

const ADMIN_LOGIN_EMAIL =
  process.env.ADMIN_LOGIN_EMAIL ?? "admin@local.test";

const ADMIN_LOGIN_PASSWORD =
  process.env.ADMIN_LOGIN_PASSWORD ?? "admin123";

const AUTH_COOKIE_SECRET =
  process.env.AUTH_COOKIE_SECRET ?? "dev-school-secret";

function encodeSession(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string" ? body.email.trim() : "";
    const password =
      typeof body?.password === "string" ? body.password : "";

    if (
      email !== ADMIN_LOGIN_EMAIL ||
      password !== ADMIN_LOGIN_PASSWORD
    ) {
      return NextResponse.json(
        {
          message: "Invalid credentials.",
          debug: {
            expectedEmail: ADMIN_LOGIN_EMAIL,
            receivedEmail: email,
          },
        },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      ok: true,
      email,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: encodeSession(`${email}::${AUTH_COOKIE_SECRET}`),
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
        message: "Login route crashed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}