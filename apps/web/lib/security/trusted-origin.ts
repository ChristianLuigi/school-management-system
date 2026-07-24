import { NextRequest, NextResponse } from "next/server";

const DEVELOPMENT_LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

function isAllowedOrigin(origin: string, expectedOrigin: string) {
  if (origin === expectedOrigin) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const actual = new URL(origin);
    const expected = new URL(expectedOrigin);

    return (
      DEVELOPMENT_LOOPBACK_HOSTS.has(actual.hostname) &&
      DEVELOPMENT_LOOPBACK_HOSTS.has(expected.hostname) &&
      actual.protocol === expected.protocol &&
      actual.port === expected.port
    );
  } catch {
    return false;
  }
}

export function assertTrustedOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_PUBLIC_URL
    ? new URL(process.env.APP_PUBLIC_URL).origin
    : request.nextUrl.origin;
  if (!origin || !isAllowedOrigin(origin, expected)) {
    return NextResponse.json({ message: "Request origin is not allowed." }, { status: 403 });
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return NextResponse.json({ message: "Cross-site request rejected." }, { status: 403 });
  }
  return null;
}