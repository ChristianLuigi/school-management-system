"use client";

import { ChangeEvent, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { createSafeCsv } from "@/lib/csv/safe-csv";
import { parseCsv } from "@/lib/csv/parse-csv";

const REQUIRED_HEADERS = [
  "first_name",
  "last_name",
  "staff_category",
  "employment_type",
] as const;

const SUPPORTED_HEADERS = new Set([
  ...REQUIRED_HEADERS,
  "preferred_name",
  "email",
  "phone",
  "staff_code",
  "hire_date",
  "job_title",
  "department",
  "work_location",
]);

type ImportIssue = {
  code: string;
  field: string;
  message: string;
};

type PreviewResponse = {
  importMode: "DRAFT_ONLY";
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
      email: string | null;
      staffCode: string | null;
      staffCategory: string | null;
      employmentType: string | null;
      employmentStatus: "DRAFT";
    };
    valid: boolean;
    errors: ImportIssue[];
    warnings: ImportIssue[];
  }>;
};

const COPY = {
  fr: {
    title: "Aperçu de l’importation CSV",
    description:
      "Validez jusqu’à 500 dossiers avant toute création. Cette étape ne modifie aucune donnée.",
    template: "Télécharger le modèle",
    choose: "Choisir un fichier CSV",
    checking: "Validation…",
    importing: "Importation…",
    import: "Importer les dossiers",
    close: "Fermer",
    draftOnly: "Les dossiers importés seront créés comme brouillons.",
    previewOnly: "Aperçu seulement — aucun dossier n’a été créé.",
    total: "Lignes",
    valid: "Valides",
    invalid: "Invalides",
    warnings: "Avec avertissement",
    row: "Ligne",
    ready: "Toutes les lignes sont valides. Vous pouvez lancer l’importation.",
  },
  en: {
    title: "CSV import preview",
    description:
      "Validate up to 500 records before any creation. This step does not change data.",
    template: "Download template",
    choose: "Choose CSV file",
    checking: "Validating…",
    importing: "Importing…",
    import: "Import staff records",
    close: "Close",
    draftOnly: "Imported records will be created as drafts.",
    previewOnly: "Preview only — no staff record was created.",
    total: "Rows",
    valid: "Valid",
    invalid: "Invalid",
    warnings: "With warnings",
    row: "Row",
    ready: "All rows are valid. You can run the import.",
  },
} as const;

function downloadTemplate() {
  const csv = createSafeCsv([
    [
      "first_name",
      "last_name",
      "preferred_name",
      "email",
      "phone",
      "staff_code",
      "staff_category",
      "employment_type",
      "hire_date",
      "job_title",
      "department",
      "work_location",
    ],
    [
      "Marie",
      "Laurent",
      "",
      "marie.laurent@example.com",
      "",
      "STF-000101",
      "TEACHING",
      "FULL_TIME",
      "2026-08-01",
      "Teacher",
      "Academics",
      "Main campus",
    ],
  ]);
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "staff-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function StaffImportPreviewClient({
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
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingPayload, setPendingPayload] = useState("");
  const [error, setError] = useState("");

  async function previewFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setPendingPayload("");
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Please select a .csv file.");
      }
      if (file.size > 1024 * 1024) {
        throw new Error("The CSV file cannot exceed 1 MB.");
      }
      let source: string;
      try {
        source = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
      } catch {
        throw new Error("The CSV file must use valid UTF-8 encoding.");
      }
      const parsed = parseCsv(source, { maxRows: 500, recordLabel: "staff" });
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
      const rows = parsed.rows.map((row, index) => ({
        rowNumber: index + 2,
        firstName: valueAt(row, "first_name"),
        lastName: valueAt(row, "last_name"),
        preferredName: valueAt(row, "preferred_name"),
        email: valueAt(row, "email"),
        phone: valueAt(row, "phone"),
        staffCode: valueAt(row, "staff_code"),
        staffCategory: valueAt(row, "staff_category"),
        employmentType: valueAt(row, "employment_type"),
        hireDate: valueAt(row, "hire_date"),
        jobTitle: valueAt(row, "job_title"),
        department: valueAt(row, "department"),
        workLocation: valueAt(row, "work_location"),
      }));
      const payload = JSON.stringify({ schoolId, rows });
      const response = await fetch(
        "/api/staff-management/staff-import/preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to validate the staff file.");
      }
      setPreview(body as PreviewResponse);
      setPendingPayload(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to validate the staff file.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function importFile() {
    if (!preview?.readyForImport || !pendingPayload) return;
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/staff-management/staff-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: pendingPayload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to import the staff file.");
      }
      setPreview(null);
      setPendingPayload("");
      onImported();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to import the staff file.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-950">{copy.title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {copy.description}
          </p>
          <p className="mt-2 text-xs font-medium text-blue-800">
            {copy.draftOnly}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          {copy.close}
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          {loading ? copy.checking : copy.choose}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            onChange={(event) => void previewFile(event)}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
        >
          {copy.template}
        </button>
      </div>
      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {preview ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {copy.previewOnly}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              [copy.total, preview.summary.totalRows],
              [copy.valid, preview.summary.validRows],
              [copy.invalid, preview.summary.invalidRows],
              [copy.warnings, preview.summary.warningRows],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-xl font-semibold text-slate-950">
                  {value}
                </div>
              </div>
            ))}
          </div>
          {preview.readyForImport ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <span>{copy.ready}</span>
              <button
                type="button"
                disabled={importing}
                onClick={() => void importFile()}
                className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {importing ? copy.importing : copy.import}
              </button>
            </div>
          ) : null}
          <div className="space-y-2">
            {preview.rows.map((row) => (
              <div
                key={row.rowNumber}
                className={`rounded-xl border bg-white p-3 ${
                  row.valid ? "border-slate-200" : "border-red-200"
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-medium text-slate-950">
                    {copy.row} {row.rowNumber}: {row.normalized.firstName ?? "—"}{" "}
                    {row.normalized.lastName ?? "—"}
                  </div>
                  <div className="text-xs text-slate-500">
                    {row.normalized.staffCode ?? "AUTO"} ·{" "}
                    {row.normalized.staffCategory ?? "—"} ·{" "}
                    {row.normalized.employmentType ?? "—"}
                  </div>
                </div>
                {row.errors.map((issue) => (
                  <p key={`${issue.field}:${issue.code}`} className="mt-2 text-xs text-red-700">
                    {issue.message}
                  </p>
                ))}
                {row.warnings.map((issue) => (
                  <p key={`${issue.field}:${issue.code}`} className="mt-2 text-xs text-amber-700">
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
