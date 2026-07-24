import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export function getSessionCookieName() {
  if (process.env.AUTH_COOKIE_NAME) return process.env.AUTH_COOKIE_NAME;
  return process.env.NODE_ENV === "production" ? "__Host-almac_session" : "almac_session";
}

export function getSessionCookieOptions(expiresAt?: Date): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
