import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

export const AUTH_SCHOOL_COOKIE_NAME =
  process.env.AUTH_SCHOOL_COOKIE_NAME ?? "school_current_id";

export async function getServerToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getServerSchoolId() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_SCHOOL_COOKIE_NAME)?.value ?? null;
}

export async function hasServerSession() {
  const token = await getServerToken();
  return Boolean(token);
}