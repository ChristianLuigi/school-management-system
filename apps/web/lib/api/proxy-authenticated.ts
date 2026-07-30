import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";
import { getRequestId } from "@/lib/api/request-id";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function proxyAuthenticated(
  request: NextRequest,
  input: { path: string; method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE" },
) {
  const requestId = getRequestId(request);
  if (input.method !== "GET") {
    const failure=assertTrustedOrigin(request);
    if(failure) return failure;
  }
  const token=request.cookies.get(getSessionCookieName())?.value;
  if(!token) return NextResponse.json({message:"Authentication required."},{status:401});
  const idempotencyKey = request.headers.get("idempotency-key");
  const upstream=await fetch(`${API_BASE_URL}${input.path}`,{
    method:input.method,
    headers:{
      Authorization:`Bearer ${token}`,
      "X-Request-Id":requestId,
      ...(idempotencyKey ? {"Idempotency-Key": idempotencyKey} : {}),
      ...(input.method!=="GET"?{"Content-Type":"application/json"}:{}),
    },
    ...(input.method!=="GET"?{body:await request.text()}:{}),
    cache:"no-store",
  });
  return new NextResponse(await upstream.text(),{
    status:upstream.status,
    headers:{"Content-Type":upstream.headers.get("content-type")??"application/json","Cache-Control":"no-store","X-Request-Id":upstream.headers.get("x-request-id")??requestId},
  });
}
