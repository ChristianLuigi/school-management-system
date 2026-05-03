import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function forwardRequest(request: NextRequest, context: RouteContext) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";

  if (!token) {
    return NextResponse.json(
      { message: "Missing bearer token." },
      { status: 401 },
    );
  }

  const { path } = await context.params;
  const cleanPath = path.join("/");
  const query = request.nextUrl.search;
  const upstreamUrl = `${API_BASE_URL}/${cleanPath}${query}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("Accept", accept);
  }

  const hasRequestBody = !["GET", "HEAD"].includes(request.method.toUpperCase());
  const requestBody = hasRequestBody ? await request.text() : "";

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      cache: "no-store",
      body: hasRequestBody && requestBody ? requestBody : undefined,
    });

    const body = await upstream.text();
    const responseHeaders = new Headers();
    const responseType = upstream.headers.get("content-type");
    if (responseType) {
      responseHeaders.set("content-type", responseType);
    }

    const contentDisposition = upstream.headers.get("content-disposition");
    if (contentDisposition) {
      responseHeaders.set("content-disposition", contentDisposition);
    }

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to reach upstream API.",
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return forwardRequest(request, context);
}
