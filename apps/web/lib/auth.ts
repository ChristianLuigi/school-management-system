import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

const ADMIN_LOGIN_EMAIL =
  process.env.ADMIN_LOGIN_EMAIL ?? "admin@local.test";

const ADMIN_LOGIN_PASSWORD =
  process.env.ADMIN_LOGIN_PASSWORD ?? "admin123";

const AUTH_COOKIE_SECRET =
  process.env.AUTH_COOKIE_SECRET ?? "dev-school-secret";

function encodeSession(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeSession(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

export function isValidAdminLogin(email: string, password: string) {
  return email === ADMIN_LOGIN_EMAIL && password === ADMIN_LOGIN_PASSWORD;
}

export function buildSessionValue(email: string) {
  return encodeSession(`${email}::${AUTH_COOKIE_SECRET}`);
}

export function verifySessionValue(value: string | undefined) {
  if (!value) return false;

  try {
    const decoded = decodeSession(value);
    return decoded.endsWith(`::${AUTH_COOKIE_SECRET}`);
  } catch {
    return false;
  }
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionValue(value);
}