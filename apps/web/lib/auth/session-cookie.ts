import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export function getSessionCookieName() {
  if (process.env.AUTH_COOKIE_NAME) return process.env.AUTH_COOKIE_NAME;
  return process.env.NODE_ENV === "production" ? "__Host-almac_session" : "almac_session";
}

export function getSessionCookieOptions(expiresAt?: Date): Partial<ResponseCookie> {
  const configuredSameSite = process.env.AUTH_COOKIE_SAME_SITE;
  const sameSite =
    configuredSameSite === "strict" || configuredSameSite === "lax"
      ? configuredSameSite
      : "lax";

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite,
    path: "/",
    ...(expiresAt
      ? {
          expires: expiresAt,
          maxAge: Math.max(
            0,
            Math.floor((expiresAt.getTime() - Date.now()) / 1000),
          ),
        }
      : {}),
  };
}
