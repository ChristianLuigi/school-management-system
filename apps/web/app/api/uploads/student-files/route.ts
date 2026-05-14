import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "school_admin_session";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const STORAGE_ROOT = path.join(
  process.cwd(),
  ".private_uploads",
  "student-files",
);

function sanitize(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "bin";
}

function mimeFromExtension(fileKey: string) {
  const lower = fileKey.toLowerCase();

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";

  return "application/octet-stream";
}

function safeResolveFilePath(fileKey: string) {
  if (!fileKey || fileKey.includes("..") || fileKey.startsWith("/")) {
    throw new Error("Invalid file key.");
  }

  const resolved = path.join(STORAGE_ROOT, fileKey);

  if (!resolved.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid file path.");
  }

  return resolved;
}

async function verifyStudentAccess(input: {
  token: string;
  schoolId: string;
  studentId: string;
}) {
  const url = new URL(`${API_BASE_URL}/school-students/${input.studentId}`);

  url.searchParams.set("schoolId", input.schoolId);

  const upstream = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Missing session token." },
      { status: 401 },
    );
  }

  const formData = await request.formData();

  const file = formData.get("file");
  const schoolId = String(formData.get("schoolId") ?? "");
  const studentId = String(formData.get("studentId") ?? "");
  const category = String(formData.get("category") ?? "document");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Missing file." }, { status: 400 });
  }

  if (!schoolId || !studentId) {
    return NextResponse.json(
      { message: "Missing schoolId or studentId." },
      { status: 400 },
    );
  }

  const hasAccess = await verifyStudentAccess({
    token,
    schoolId,
    studentId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to this student file." },
      { status: 403 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { message: "Only JPG, PNG, WEBP, and PDF files are allowed." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { message: "File is too large. Maximum size is 10 MB." },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeSchoolId = sanitize(schoolId);
  const safeStudentId = sanitize(studentId);
  const safeCategory = sanitize(category);
  const originalBaseName = sanitize(
    file.name.replace(/\.[^/.]+$/, "") || "upload",
  );
  const extension = extensionFromMime(file.type);

  const storedFileName = `${Date.now()}-${randomUUID()}-${originalBaseName}.${extension}`;

  const fileKey = path
    .join(safeSchoolId, safeStudentId, safeCategory, storedFileName)
    .replaceAll("\\", "/");

  const filePath = safeResolveFilePath(fileKey);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);

  const fileUrl =
    `/api/uploads/student-files?schoolId=${encodeURIComponent(schoolId)}` +
    `&studentId=${encodeURIComponent(studentId)}` +
    `&fileKey=${encodeURIComponent(fileKey)}`;

  return NextResponse.json({
    fileName: file.name,
    storedFileName,
    fileKey,
    fileUrl,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { message: "Missing session token." },
      { status: 401 },
    );
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId") ?? "";
  const studentId = request.nextUrl.searchParams.get("studentId") ?? "";
  const fileKey = request.nextUrl.searchParams.get("fileKey") ?? "";

  if (!schoolId || !studentId || !fileKey) {
    return NextResponse.json(
      { message: "Missing schoolId, studentId, or fileKey." },
      { status: 400 },
    );
  }

  const hasAccess = await verifyStudentAccess({
    token,
    schoolId,
    studentId,
  });

  if (!hasAccess) {
    return NextResponse.json(
      { message: "You do not have access to this student file." },
      { status: 403 },
    );
  }

  let filePath: string;

  try {
    filePath = safeResolveFilePath(fileKey);
    await stat(filePath);
  } catch {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  const fileBuffer = await readFile(filePath);
  const mimeType = mimeFromExtension(fileKey);

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": "inline",
    },
  });
}
