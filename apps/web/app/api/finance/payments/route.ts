import { NextRequest } from "next/server";
import { proxyAuthenticated } from "@/lib/api/proxy-authenticated";

export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, {
    method: "POST",
    path: "/finance/payments",
  });
}
