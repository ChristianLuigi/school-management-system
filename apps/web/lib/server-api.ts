import { getServerToken } from "@/lib/auth-server";

const API_BASE_URL = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:4000"
).replace("://localhost:", "://127.0.0.1:");

export async function serverApiGet<T>(path: string): Promise<T> {
  const token = await getServerToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!res.ok) {
    throw new Error(`GET ${path} failed with status ${res.status}.`);
  }

  return res.json();
}