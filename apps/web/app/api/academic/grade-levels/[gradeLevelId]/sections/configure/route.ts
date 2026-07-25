import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gradeLevelId: string }> },
) {
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Missing session token." },
      { status: 401 },
    );
  }

  const { gradeLevelId } = await params;
  const body = await request.text();

  const upstream = await fetch(
    `${API_BASE_URL}/academic/grade-levels/${gradeLevelId}/sections/configure`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ gradeLevelId: string }> },
) {
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Missing session token." },
      { status: 401 },
    );
  }

  const { gradeLevelId } = await params;
  const body = await request.text();

  const upstream = await fetch(
    `${API_BASE_URL}/academic/grade-levels/${gradeLevelId}/sections/configure`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    },
  );

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
