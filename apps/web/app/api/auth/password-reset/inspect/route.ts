import { NextRequest, NextResponse } from "next/server";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;
  const upstream = await fetch(`${API_BASE_URL}/auth/password-reset/inspect`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: await request.text(), cache: "no-store",
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    },
  });
}