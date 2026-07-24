import { getSessionCookieName } from "@/lib/auth/session-cookie";

export const AUTH_COOKIE_NAME = getSessionCookieName();
export const AUTH_SCHOOL_COOKIE_NAME = process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";
