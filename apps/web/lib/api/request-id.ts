import type { NextRequest } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function getRequestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id");
  if (incoming && REQUEST_ID_PATTERN.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}