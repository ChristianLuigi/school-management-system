import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";
export async function GET(request: NextRequest) {
  const params = new URLSearchParams();
  for (const name of ["schoolId", "kind", "search", "page"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value !== null) params.set(name, value);
  }
  return proxyAuthenticated(request, {
    method: "GET",
    path: `/school-students/cleanup?${params}`,
  });
}
export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "POST",
    path: "/school-students/cleanup",
  });
}
