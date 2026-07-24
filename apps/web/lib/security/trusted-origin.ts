import { NextRequest, NextResponse } from "next/server";

export function assertTrustedOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_PUBLIC_URL
    ? new URL(process.env.APP_PUBLIC_URL).origin
    : request.nextUrl.origin;
  if (!origin || origin !== expected) {
    return NextResponse.json({ message: "Request origin is not allowed." }, { status: 403 });
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return NextResponse.json({ message: "Cross-site request rejected." }, { status: 403 });
  }
  return null;
}
