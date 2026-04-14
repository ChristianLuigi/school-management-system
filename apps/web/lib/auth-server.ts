import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, AUTH_SCHOOL_COOKIE_NAME } from "@/lib/auth";

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