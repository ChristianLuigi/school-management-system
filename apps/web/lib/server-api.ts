import { getServerToken } from "@/lib/auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }

  return res.json();
}