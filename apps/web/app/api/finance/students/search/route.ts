import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (!token) {
    return NextResponse.json({ message: "Missing session token." }, { status: 401 });
  }

  const upstreamUrl = new URL(`${API_BASE_URL}/finance/students/search`);

  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const upstream = await fetch(upstreamUrl.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
