import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.cookies.get(getSessionCookieName())?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Missing session token." },
      { status: 401 },
    );
  }

  const { id } = await params;

  const upstream = await fetch(`${API_BASE_URL}/report-cards/batches/${id}`, {
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
