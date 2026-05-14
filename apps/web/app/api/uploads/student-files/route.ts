import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

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

export async function POST(request: NextRequest) {
  const token = request.cookies.get("school_admin_session")?.value;

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
  const originalName = sanitize(file.name || "upload");
  const extension = extensionFromMime(file.type);

  const fileName = `${Date.now()}-${crypto.randomUUID()}-${originalName}.${extension}`;

  const relativeFolder = `/uploads/student-files/${safeSchoolId}/${safeStudentId}/${safeCategory}`;
  const publicFolder = path.join(process.cwd(), "public", relativeFolder);

  await mkdir(publicFolder, { recursive: true });

  const filePath = path.join(publicFolder, fileName);

  await writeFile(filePath, buffer);

  return NextResponse.json({
    fileName: file.name,
    storedFileName: fileName,
    mimeType: file.type,
    sizeBytes: file.size,
    fileUrl: `${relativeFolder}/${fileName}`,
  });
}
