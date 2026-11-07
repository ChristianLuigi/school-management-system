"use client";

import { useState, type ChangeEvent } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PaginatedCollection } from "@/components/paginated-collection";
import { Button } from "@/components/ui/button";
import { parseCsv } from "@/lib/csv/parse-csv";
import { createSafeCsv } from "@/lib/csv/safe-csv";

const HEADERS = [
  "student_code",
  "guardian_reference",
  "first_name",
  "last_name",
  "relationship",
  "email",
  "phone",
  "is_primary",
];
const ISSUES: Record<string, [string, string]> = {
  DUPLICATE_ROW: ["Numéro de ligne répété.", "Repeated row number."],
  INVALID_REFERENCE: [
    "Référence requise : A–Z, chiffres, point, tiret ou soulignement (80 caractères max).",
    "Reference required: A–Z, digits, dot, hyphen or underscore (80 characters max).",
  ],
  NAME_REQUIRED: [
    "Prénom et nom requis (200 caractères maximum au total).",
    "First and last names required (200 characters total maximum).",
  ],
  CONTACT_REQUIRED: [
    "Indiquez un email ou un téléphone.",
    "Provide an email or phone.",
  ],
  INVALID_EMAIL: ["Email invalide.", "Invalid email."],
  INVALID_PHONE: ["Téléphone invalide.", "Invalid phone."],
  INVALID_RELATIONSHIP: [
    "Lien attendu : MOTHER, FATHER, TUTOR ou OTHER.",
    "Relationship must be MOTHER, FATHER, TUTOR or OTHER.",
  ],
  STUDENT_REQUIRED: [
    "Un contact principal nécessite un code élève.",
    "A primary contact requires a student code.",
  ],
  REFERENCE_CONFLICT: [
    "Cette référence a des coordonnées différentes dans le fichier.",
    "This reference has conflicting details in the file.",
  ],
  EXISTING_DATA_CONFLICT: [
    "Les coordonnées diffèrent de la fiche existante. Corrigez la fiche ou le fichier.",
    "Details differ from the existing record. Correct the record or file.",
  ],
  POSSIBLE_DUPLICATE: [
    "Email ou téléphone déjà utilisé : vérification manuelle requise.",
    "Email or phone already used: manual review required.",
  ],
  STUDENT_NOT_FOUND: [
    "Code élève introuvable ou ambigu dans cette école.",
    "Student code missing or ambiguous in this school.",
  ],
  DUPLICATE_LINK: [
    "Association répétée dans le fichier.",
    "Repeated link in the file.",
  ],
  LINK_CONFLICT: [
    "Le lien existant diffère : modifiez-le dans la fiche élève.",
    "Existing link differs: edit it in the student record.",
  ],
  PRIMARY_CONFLICT: [
    "Un autre responsable est déjà principal pour cet élève.",
    "Another guardian is already primary for this student.",
  ],
};
type Preview = {
  readyForImport: boolean;
  summary: { totalRows: number; validRows: number; invalidRows: number };
  rows: {
    rowNumber: number;
    normalized: {
      fullName: string;
      guardianReference: string;
      studentCode: string;
    };
    action: string;
    errors: string[];
  }[];
};

export function GuardianImportClient({
  schoolId,
  onClose,
}: {
  schoolId: string;
  onClose: () => void;
}) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [payload, setPayload] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    linked: number;
    reused: number;
  } | null>(null);
  const failure = fr
    ? "Impossible de traiter le fichier. Vérifiez son format et vos autorisations, puis réessayez."
    : "Unable to process the file. Check its format and your permissions, then retry.";

  function template() {
    const csv = createSafeCsv([
      HEADERS,
      [
        "",
        "RESP-001",
        "Marie",
        "Joseph",
        "MOTHER",
        "marie@example.com",
        "50937000000",
        "false",
      ],
    ]);
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "guardian-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setPayload("");
    setResult(null);
    try {
      if (
        !file.name.toLowerCase().endsWith(".csv") ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error(
          fr
            ? "Choisissez un CSV de 2 Mo maximum."
            : "Choose a CSV up to 2 MB.",
        );
      let parsed: ReturnType<typeof parseCsv>;
      try {
        parsed = parseCsv(
          new TextDecoder("utf-8", { fatal: true }).decode(
            await file.arrayBuffer(),
          ),
          { maxRows: 1000 },
        );
      } catch {
        throw new Error(
          fr
            ? "CSV UTF-8 invalide : vérifiez les virgules, les guillemets et la limite de 1 000 lignes."
            : "Invalid UTF-8 CSV: check commas, quotes and the 1,000-row limit.",
        );
      }
      if (
        ["guardian_reference", "first_name", "last_name"].some(
          (h) => !parsed.headers.includes(h),
        ) ||
        parsed.headers.some((h) => !HEADERS.includes(h))
      )
        throw new Error(
          fr
            ? "Colonnes incorrectes. Utilisez le modèle téléchargeable."
            : "Incorrect columns. Use the downloadable template.",
        );
      const rows = parsed.rows.map((r, index) => {
        const get = (h: string) => r[parsed.headers.indexOf(h)]?.trim() || "";
        const primary = get("is_primary").toLowerCase();
        if (
          !["", "true", "false", "oui", "non", "yes", "no", "1", "0"].includes(
            primary,
          )
        )
          throw new Error(
            fr
              ? `Ligne ${index + 2} : is_primary doit être true ou false.`
              : `Row ${index + 2}: is_primary must be true or false.`,
          );
        return {
          rowNumber: index + 2,
          guardianReference: get("guardian_reference"),
          firstName: get("first_name"),
          lastName: get("last_name"),
          studentCode: get("student_code"),
          relationship: get("relationship"),
          email: get("email"),
          phone: get("phone"),
          isPrimary: ["true", "oui", "yes", "1"].includes(primary),
        };
      });
      const nextPayload = JSON.stringify({ schoolId, rows });
      const response = await fetch(
        "/api/school-students/guardians/import/preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: nextPayload,
        },
      );
      if (!response.ok) throw new Error(failure);
      setPreview(await response.json());
      setPayload(nextPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : failure);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview?.readyForImport || !payload || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/school-students/guardians/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (body?.preview) setPreview(body.preview);
        throw new Error(failure);
      }
      setResult(body);
      setPreview(null);
      setPayload("");
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">
            {fr ? "Importer des responsables" : "Import guardians"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {fr
              ? "CSV UTF-8 · 1 000 lignes max · Aucun compte ni invitation créé."
              : "UTF-8 CSV · Up to 1,000 rows · No accounts or invitations created."}
          </p>
        </div>
        <Button disabled={busy} onClick={onClose}>
          {fr ? "Fermer" : "Close"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {fr
          ? "Réutilisez la même guardian_reference pour une fratrie. Laissez student_code vide pour créer une fiche seule. Les fiches existantes ne sont pas écrasées."
          : "Reuse the same guardian_reference for siblings. Leave student_code empty for a standalone record. Existing records are not overwritten."}
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input px-4 py-2 text-foreground focus-within:ring-2 focus-within:ring-ring">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
          {fr ? "Choisir un CSV" : "Choose CSV"}
          <input
            aria-label={
              fr ? "Fichier CSV des responsables" : "Guardian CSV file"
            }
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => void choose(e)}
          />
        </label>
        <Button onClick={template}>
          <Download className="h-4 w-4" />
          {fr ? "Télécharger le modèle" : "Download template"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-danger-subtle p-3 text-danger">
          {error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className="rounded-xl bg-success-subtle p-3 text-success"
        >
          {fr
            ? `Import terminé : ${result.created} fiches créées, ${result.reused} réutilisées, ${result.linked} associations créées.`
            : `Import complete: ${result.created} records created, ${result.reused} reused, ${result.linked} links created.`}
        </p>
      )}
      {preview && (
        <>
          <p role="status" className="text-sm text-foreground">
            {fr
              ? `${preview.summary.totalRows} lignes · ${preview.summary.validRows} valides · ${preview.summary.invalidRows} invalides`
              : `${preview.summary.totalRows} rows · ${preview.summary.validRows} valid · ${preview.summary.invalidRows} invalid`}
          </p>
          <PaginatedCollection items={preview.rows}>
            {(row) => (
              <div
                key={row.rowNumber}
                className="my-2 rounded-xl border border-border p-3 text-sm text-foreground"
              >
                <p>
                  {row.rowNumber} · {row.normalized.fullName} ·{" "}
                  {row.normalized.guardianReference} ·{" "}
                  {row.normalized.studentCode ||
                    (fr ? "Sans élève" : "No student")}{" "}
                  ·{" "}
                  {row.action === "CREATE"
                    ? fr
                      ? "Créer"
                      : "Create"
                    : fr
                      ? "Réutiliser"
                      : "Reuse"}
                </p>
                {row.errors.map((code) => (
                  <p key={code} className="mt-1 text-danger">
                    {ISSUES[code]?.[fr ? 0 : 1] ?? failure}
                  </p>
                ))}
              </div>
            )}
          </PaginatedCollection>
          <Button
            variant="primary"
            disabled={busy || !preview.readyForImport}
            onClick={() => void commit()}
          >
            {busy
              ? fr
                ? "Traitement…"
                : "Processing…"
              : fr
                ? "Confirmer l’import"
                : "Confirm import"}
          </Button>
        </>
      )}
    </section>
  );
}
