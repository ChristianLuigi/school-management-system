"use client";

import { ChangeEvent, useState } from "react";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { createSafeCsv } from "@/lib/csv/safe-csv";
import { parseCsv } from "@/lib/csv/parse-csv";

const REQUIRED_HEADERS = ["first_name", "last_name"] as const;
const SUPPORTED_HEADERS = new Set([
  ...REQUIRED_HEADERS,
  "student_code",
  "gender",
  "date_of_birth",
  "place_of_birth",
  "section_id",
  "previous_school_name",
  "previous_school_address",
  "photo_received",
  "birth_certificate_received",
  "vaccination_card_received",
  "previous_school_record_received",
]);

type ImportIssue = { code: string; field: string; message: string };
type PreviewResponse = {
  importMode: "ATOMIC";
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
  };
  readyForImport: boolean;
  rows: Array<{
    rowNumber: number;
    normalized: {
      firstName: string | null;
      lastName: string | null;
      studentCode: string | null;
      studentStatus: "REGISTERED" | "ACTIVE";
    };
    valid: boolean;
    errors: ImportIssue[];
    warnings: ImportIssue[];
  }>;
};

const COPY = {
  fr: {
    title: "Importer des élèves",
    description:
      "Validez jusqu’à 1 000 lignes avant une importation atomique.",
    choose: "Choisir un CSV",
    template: "Télécharger le modèle",
    validating: "Validation…",
    import: "Importer les élèves",
    importing: "Importation…",
    close: "Fermer",
    total: "Lignes",
    valid: "Valides",
    invalid: "Invalides",
    warnings: "Avertissements",
    row: "Ligne",
    ready: "Toutes les lignes sont valides. Aucun import partiel ne sera créé.",
    shown: "Seules les 25 premières lignes sont affichées.",
  },
  en: {
    title: "Import students",
    description: "Validate up to 1,000 rows before one atomic import.",
    choose: "Choose CSV",
    template: "Download template",
    validating: "Validating…",
    import: "Import students",
    importing: "Importing…",
    close: "Close",
    total: "Rows",
    valid: "Valid",
    invalid: "Invalid",
    warnings: "Warnings",
    row: "Row",
    ready: "All rows are valid. No partial import will be created.",
    shown: "Only the first 25 rows are shown.",
  },
} as const;

function downloadTemplate() {
  const csv = createSafeCsv([
    [
      "first_name",
      "last_name",
      "student_code",
      "gender",
      "date_of_birth",
      "place_of_birth",
      "section_id",
      "previous_school_name",
      "previous_school_address",
      "photo_received",
      "birth_certificate_received",
      "vaccination_card_received",
      "previous_school_record_received",
    ],
    [
      "Marie",
      "Jean",
      "",
      "FEMALE",
      "2014-05-19",
      "Port-au-Prince",
      "",
      "École Exemple",
      "Pétion-Ville",
      "false",
      "true",
      "true",
      "false",
    ],
  ]);
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function parseBoolean(value: string | undefined, row: number, field: string) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized || ["false", "no", "non", "0"].includes(normalized)) {
    return false;
  }
  if (["true", "yes", "oui", "1"].includes(normalized)) return true;
  throw new Error(
    `Row ${row}: ${field} must be true/false, yes/no, oui/non, or 1/0.`,
  );
}

export function StudentImportClient({
  schoolId,
  onClose,
  onImported,
}: {
  schoolId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pendingPayload, setPendingPayload] = useState("");
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  async function previewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setValidating(true);
    setError("");
    setPreview(null);
    setPendingPayload("");
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Please select a .csv file.");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("The CSV file cannot exceed 2 MB.");
      }
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new Error("The CSV file must use valid UTF-8 encoding.");
      }
      const parsed = parseCsv(source, {
        maxRows: 1000,
        recordLabel: "student",
      });
      const missing = REQUIRED_HEADERS.filter(
        (header) => !parsed.headers.includes(header),
      );
      if (missing.length) {
        throw new Error(`Missing required columns: ${missing.join(", ")}.`);
      }
      const unsupported = parsed.headers.filter(
        (header) => !SUPPORTED_HEADERS.has(header),
      );
      if (unsupported.length) {
        throw new Error(`Unsupported columns: ${unsupported.join(", ")}.`);
      }
      const valueAt = (row: string[], name: string) => {
        const index = parsed.headers.indexOf(name);
        return index >= 0 ? row[index] : undefined;
      };
      const rows = parsed.rows.map((row, index) => {
        const rowNumber = index + 2;
        return {
          rowNumber,
          firstName: valueAt(row, "first_name"),
          lastName: valueAt(row, "last_name"),
          studentCode: valueAt(row, "student_code"),
          gender: valueAt(row, "gender"),
          dateOfBirth: valueAt(row, "date_of_birth"),
          placeOfBirth: valueAt(row, "place_of_birth"),
          sectionId: valueAt(row, "section_id")?.trim() || undefined,
          previousSchoolName: valueAt(row, "previous_school_name"),
          previousSchoolAddress: valueAt(row, "previous_school_address"),
          photoReceived: parseBoolean(
            valueAt(row, "photo_received"),
            rowNumber,
            "photo_received",
          ),
          birthCertificateReceived: parseBoolean(
            valueAt(row, "birth_certificate_received"),
            rowNumber,
            "birth_certificate_received",
          ),
          vaccinationCardReceived: parseBoolean(
            valueAt(row, "vaccination_card_received"),
            rowNumber,
            "vaccination_card_received",
          ),
          previousSchoolRecordReceived: parseBoolean(
            valueAt(row, "previous_school_record_received"),
            rowNumber,
            "previous_school_record_received",
          ),
        };
      });
      const payload = JSON.stringify({ schoolId, rows });
      const response = await fetch("/api/school-students/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to validate the student file.");
      }
      setPreview(body as PreviewResponse);
      setPendingPayload(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to validate the student file.",
      );
    } finally {
      setValidating(false);
    }
  }

  async function importStudents() {
    if (!preview?.readyForImport || !pendingPayload) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/school-students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingPayload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to import students.");
      }
      onImported();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to import students.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{copy.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {copy.close}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          {validating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {validating ? copy.validating : copy.choose}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={validating || importing}
            onChange={(event) => void previewFile(event)}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          <Download className="h-4 w-4" />
          {copy.template}
        </button>
      </div>
      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {preview ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              [copy.total, preview.summary.totalRows],
              [copy.valid, preview.summary.validRows],
              [copy.invalid, preview.summary.invalidRows],
              [copy.warnings, preview.summary.warningRows],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
          {preview.readyForImport ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <span>{copy.ready}</span>
              <button
                type="button"
                disabled={importing}
                onClick={() => void importStudents()}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importing ? copy.importing : copy.import}
              </button>
            </div>
          ) : null}
          {preview.rows.length > 25 ? (
            <p className="text-xs text-slate-500">{copy.shown}</p>
          ) : null}
          <div className="space-y-2">
            {preview.rows.slice(0, 25).map((row) => (
              <div
                key={row.rowNumber}
                className={`rounded-xl border bg-white p-3 ${
                  row.valid ? "border-slate-200" : "border-red-200"
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-950">
                    {copy.row} {row.rowNumber}: {row.normalized.firstName ?? "—"}{" "}
                    {row.normalized.lastName ?? "—"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {row.normalized.studentCode ?? "AUTO"} · {row.normalized.studentStatus}
                  </span>
                </div>
                {row.errors.map((issue) => (
                  <p key={`${issue.field}:${issue.code}`} className="mt-1 text-xs text-red-700">
                    {issue.message}
                  </p>
                ))}
                {row.warnings.map((issue) => (
                  <p key={`${issue.field}:${issue.code}`} className="mt-1 text-xs text-amber-700">
                    {issue.message}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
