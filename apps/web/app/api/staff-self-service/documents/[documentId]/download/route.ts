import { readFile, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getRequestId } from "@/lib/api/request-id";
import { getSessionCookieName } from "@/lib/auth/session-cookie";

export const runtime = "nodejs";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STORAGE_ROOT = process.env.UPLOAD_STORAGE_ROOT
  ? path.resolve(process.env.UPLOAD_STORAGE_ROOT, "staff-documents")
  : path.join(process.cwd(), ".private_uploads", "staff-documents");

function safeResolveFilePath(fileKey: string) {
  if (
    !fileKey ||
    fileKey.includes("..") ||
    fileKey.includes("\\") ||
    fileKey.startsWith("/")
  ) {
    throw new Error("Invalid file key.");
  }
  const resolved = path.resolve(STORAGE_ROOT, fileKey);
  const relative = path.relative(STORAGE_ROOT, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid file path.");
  }
  return resolved;
}

function upstreamResponse(response: Response, body: string, requestId: string) {
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      "X-Request-Id": response.headers.get("x-request-id") ?? requestId,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const requestId = getRequestId(request);
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401, headers: { "X-Request-Id": requestId } },
    );
  }
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  const { documentId } = await params;
  if (!UUID_PATTERN.test(schoolId) || !UUID_PATTERN.test(documentId)) {
    return NextResponse.json(
      { message: "Invalid document request." },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  const url = new URL(
    `${API_BASE_URL}/staff-self-service/documents/${encodeURIComponent(
      documentId,
    )}/download`,
  );
  url.searchParams.set("schoolId", schoolId);
  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Request-Id": requestId,
    },
    cache: "no-store",
  });
  const upstreamBody = await upstream.text();
  if (!upstream.ok) {
    return upstreamResponse(upstream, upstreamBody, requestId);
  }

  const metadata = JSON.parse(upstreamBody) as {
    staffAccountId: string;
    storageKey: string;
    originalFileName: string;
    mimeType: string;
    fileSizeBytes: number;
  };
  const expectedPrefix = `${schoolId}/${metadata.staffAccountId}/`;
  if (
    !UUID_PATTERN.test(metadata.staffAccountId) ||
    !metadata.storageKey.startsWith(expectedPrefix)
  ) {
    return NextResponse.json(
      { message: "File not found." },
      { status: 404, headers: { "X-Request-Id": requestId } },
    );
  }

  let filePath: string;
  try {
    filePath = safeResolveFilePath(metadata.storageKey);
    const fileStat = await stat(filePath);
    if (
      !fileStat.isFile() ||
      fileStat.size !== metadata.fileSizeBytes ||
      fileStat.size > 10 * 1024 * 1024
    ) {
      throw new Error("Unexpected staff document file metadata.");
    }
  } catch {
    return NextResponse.json(
      { message: "File not found." },
      { status: 404, headers: { "X-Request-Id": requestId } },
    );
  }

  const fileBuffer = await readFile(filePath);
  const downloadName =
    metadata.originalFileName
      .replace(/[\r\n"]/g, "_")
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .slice(0, 180) || "staff-document";
  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": metadata.mimeType,
      "Content-Length": String(fileBuffer.length),
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Request-Id": upstream.headers.get("x-request-id") ?? requestId,
    },
  });
}
