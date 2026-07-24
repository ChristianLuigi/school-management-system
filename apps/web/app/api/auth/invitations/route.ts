import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

function respond(upstream: Response) {
  return upstream.text().then((body) => new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  }));
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Missing session." }, { status: 401 });
  const url = new URL(`${API_BASE_URL}/auth/invitations`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return respond(upstream);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "Missing session." }, { status: 401 });
  const upstream = await fetch(`${API_BASE_URL}/auth/invitations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  return respond(upstream);
}
