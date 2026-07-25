import { NextRequest, NextResponse } from "next/server";

const DEVELOPMENT_LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

export function isAllowedOrigin(
  origin: string,
  expectedOrigins: readonly string[],
) {
  if (expectedOrigins.includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  try {
    const actual = new URL(origin);
    return expectedOrigins.some((expectedOrigin) => {
      const expected = new URL(expectedOrigin);
      return (
        DEVELOPMENT_LOOPBACK_HOSTS.has(actual.hostname) &&
        DEVELOPMENT_LOOPBACK_HOSTS.has(expected.hostname) &&
        actual.protocol === expected.protocol &&
        actual.port === expected.port
      );
    });
  } catch {
    return false;
  }
}

export function assertTrustedOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const configured = (
    process.env.TRUSTED_ORIGINS ??
    process.env.APP_PUBLIC_URL ??
    ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const expectedOrigins =
    configured.length || process.env.NODE_ENV === "production"
      ? configured
      : [request.nextUrl.origin];

  if (!expectedOrigins.length) {
    return NextResponse.json(
      { message: "Trusted origin configuration is unavailable." },
      { status: 500 },
    );
  }
  if (!origin || !isAllowedOrigin(origin, expectedOrigins)) {
    return NextResponse.json(
      { message: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    return NextResponse.json(
      { message: "Cross-site request rejected." },
      { status: 403 },
    );
  }
  return null;
}