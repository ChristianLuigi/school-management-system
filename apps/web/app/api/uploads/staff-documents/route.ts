import { randomUUID } from "crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth/session-cookie";
import { assertTrustedOrigin } from "@/lib/security/trusted-origin";

export const runtime = "nodejs";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_TYPES = new Set([
  "IDENTITY",
  "CONTRACT",
  "CERTIFICATION",
  "LICENSE",
  "BACKGROUND_CHECK",
  "WORK_PERMIT",
  "OTHER",
]);
const CONFIDENTIALITY_VALUES = new Set(["STANDARD", "RESTRICTED"]);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const STORAGE_ROOT = process.env.UPLOAD_STORAGE_ROOT
  ? path.resolve(process.env.UPLOAD_STORAGE_ROOT, "staff-documents")
  : path.join(process.cwd(), ".private_uploads", "staff-documents");

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "bin";
}

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

function hasExpectedFileSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return buffer
      .subarray(0, 8)
      .equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 1024).indexOf(Buffer.from("%PDF-")) >= 0;
  }
  return false;
}

async function verifyStaffAccess(input: {
  token: string;
  schoolId: string;
  staffId: string;
}) {
  const url = new URL(
    `${API_BASE_URL}/staff-management/staff/${encodeURIComponent(input.staffId)}`,
  );
  url.searchParams.set("schoolId", input.schoolId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${input.token}` },
    cache: "no-store",
  });
  return response.ok;
}

function upstreamResponse(response: Response, body: string) {
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const originFailure = assertTrustedOrigin(request);
  if (originFailure) return originFailure;
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }
  const formData = await request.formData();
  const file = formData.get("file");
  const schoolId = String(formData.get("schoolId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");
  const documentType = String(formData.get("documentType") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const confidentiality = String(
    formData.get("confidentiality") ?? "STANDARD",
  );
  const issuedOn = String(formData.get("issuedOn") ?? "").trim();
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing file." }, { status: 400 });
  }
  if (!UUID_PATTERN.test(schoolId) || !UUID_PATTERN.test(staffId)) {
    return NextResponse.json(
      { message: "Invalid school or staff identifier." },
      { status: 400 },
    );
  }
  if (!DOCUMENT_TYPES.has(documentType) || !displayName) {
    return NextResponse.json(
      { message: "Document type and display name are required." },
      { status: 400 },
    );
  }
  if (!CONFIDENTIALITY_VALUES.has(confidentiality)) {
    return NextResponse.json(
      { message: "Invalid document confidentiality." },
      { status: 400 },
    );
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { message: "Only JPG, PNG, WEBP, and PDF files are allowed." },
      { status: 400 },
    );
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { message: "File size must be between 1 byte and 10 MB." },
      { status: 400 },
    );
  }
  const hasAccess = await verifyStaffAccess({ token, schoolId, staffId });
  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to this staff document." },
      { status: 403 },
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasExpectedFileSignature(buffer, file.type)) {
    return NextResponse.json(
      { message: "The file content does not match its declared type." },
      { status: 400 },
    );
  }

  const storedFileName = `${Date.now()}-${randomUUID()}.${extensionFromMime(
    file.type,
  )}`;
  const fileKey =
    `${schoolId}/${staffId}/${documentType}/${storedFileName}`.replaceAll(
      "\\",
      "/",
    );
  const filePath = safeResolveFilePath(fileKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);

  const upstream = await fetch(
    `${API_BASE_URL}/staff-management/staff/${encodeURIComponent(staffId)}/documents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        documentType,
        displayName,
        storageKey: fileKey,
        originalFileName: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        issuedOn: issuedOn || undefined,
        expiresOn: expiresOn || undefined,
        confidentiality,
      }),
      cache: "no-store",
    },
  );
  const upstreamBody = await upstream.text();
  if (!upstream.ok) {
    await unlink(filePath).catch(() => undefined);
    return upstreamResponse(upstream, upstreamBody);
  }
  const document = JSON.parse(upstreamBody) as { id: string };
  return NextResponse.json({
    ...document,
    downloadUrl:
      `/api/uploads/staff-documents?schoolId=${encodeURIComponent(schoolId)}` +
      `&staffId=${encodeURIComponent(staffId)}` +
      `&documentId=${encodeURIComponent(document.id)}`,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  if (!token) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    );
  }
  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  const staffId = request.nextUrl.searchParams.get("staffId") ?? "";
  const documentId = request.nextUrl.searchParams.get("documentId") ?? "";
  if (
    !UUID_PATTERN.test(schoolId) ||
    !UUID_PATTERN.test(staffId) ||
    !UUID_PATTERN.test(documentId)
  ) {
    return NextResponse.json(
      { message: "Invalid document request." },
      { status: 400 },
    );
  }
  const url = new URL(
    `${API_BASE_URL}/staff-management/staff/${encodeURIComponent(
      staffId,
    )}/documents/${encodeURIComponent(documentId)}/download`,
  );
  url.searchParams.set("schoolId", schoolId);
  const upstream = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const upstreamBody = await upstream.text();
  if (!upstream.ok) {
    return upstreamResponse(upstream, upstreamBody);
  }
  const metadata = JSON.parse(upstreamBody) as {
    storageKey: string;
    originalFileName: string;
    mimeType: string;
  };
  const expectedPrefix = `${schoolId}/${staffId}/`;
  if (!metadata.storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }
  let filePath: string;
  try {
    filePath = safeResolveFilePath(metadata.storageKey);
    await stat(filePath);
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
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
    },
  });
}
