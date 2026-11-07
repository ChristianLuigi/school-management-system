"use client";
import { useEffect, useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PaginatedCollection } from "@/components/paginated-collection";
import {
  sectionOptionLabel,
  type SectionOption,
} from "@/components/section-selector-client";

type Student = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  studentCode: string | null;
};
type Preview = {
  ready: boolean;
  errors: string[];
  selectedCount: number;
  rows: {
    id: string;
    name: string;
    code: string;
    eligible: boolean;
    reasons: string[];
  }[];
  section: {
    code: string;
    nameI18n: Record<string, string> | null;
    academicYearNameI18n: Record<string, string> | null;
    capacity: number | null;
    occupied: number;
    availableSeats: number | null;
  } | null;
};
const ERRORS: Record<string, [string, string]> = {
  SECTION_UNAVAILABLE: [
    "Classe indisponible dans cette école.",
    "Class unavailable in this school.",
  ],
  YEAR_MISMATCH: [
    "La classe ne correspond pas à l’année choisie.",
    "Class does not match the selected year.",
  ],
  YEAR_CLOSED: ["L’année scolaire est clôturée.", "Academic year is closed."],
  CAPACITY_EXCEEDED: [
    "Places insuffisantes pour toute la sélection.",
    "Not enough seats for the entire selection.",
  ],
  STUDENT_UNAVAILABLE: [
    "Élève indisponible dans cette école.",
    "Student unavailable in this school.",
  ],
  STATUS_BLOCKED: [
    "Le statut de cet élève ne permet pas l’affectation.",
    "Student status does not allow placement.",
  ],
  ALREADY_ASSIGNED: [
    "Déjà affecté : utilisez le transfert individuel.",
    "Already assigned: use the individual transfer workflow.",
  ],
};
export function BulkPlacementClient({
  schoolId,
  onClose,
  onAssigned,
}: {
  schoolId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { locale, t } = useI18n();
  const fr = locale === "fr";
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState(false);
  const [yearId, setYearId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [activate, setActivate] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dialog, setDialog] = useState(false);
  const [result, setResult] = useState<{
    assignedCount: number;
    activatedCount: number;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setOptionsLoading(true);
    setOptionsError(false);
    void fetch(
      `/api/academic/section-options?${new URLSearchParams({ schoolId })}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((body) => {
        if (active) setSections(Array.isArray(body) ? body : []);
      })
      .catch(() => {
        if (active) setOptionsError(true);
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [schoolId, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(false);
    setStudents([]);
    const params = new URLSearchParams({
      schoolId,
      enrollmentState: "UNASSIGNED",
      page: String(page),
      pageSize: "25",
      search: applied,
    });
    void fetch(`/api/school-students?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((body) => {
        if (active) {
          setStudents(body.items);
          setTotalPages(body.pagination.pageCount || 1);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [schoolId, applied, page, refresh]);
  const years = Array.from(
    new Map(
      sections.map((s) => [
        s.academicYearId,
        { id: s.academicYearId, name: s.academicYearNameI18n },
      ]),
    ).values(),
  );
  const label = (value: Record<string, string> | null, fallback: string) =>
    value?.[locale] || value?.fr || value?.en || fallback;
  function reset() {
    setIds([]);
    setPreview(null);
    setResult(null);
  }
  function toggle(id: string) {
    setPreview(null);
    setResult(null);
    setIds((current) =>
      current.includes(id)
        ? current.filter((v) => v !== id)
        : current.length < 100
          ? [...current, id]
          : current,
    );
  }
  const payload = {
    schoolId,
    academicYearId: yearId,
    sectionId,
    studentIds: ids,
    activateStudent: activate,
  };
  async function check() {
    setBusy(true);
    setError(false);
    setPreview(null);
    setResult(null);
    try {
      const r = await fetch("/api/school-students/bulk-placement/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      setPreview(await r.json());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/school-students/bulk-placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, confirmed: true }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        if (body?.preview) setPreview(body.preview);
        throw new Error();
      }
      reset();
      setResult(body);
      setPage(1);
      setRefresh((v) => v + 1);
      onAssigned();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      setDialog(false);
    }
  }
  const issue = (code: string) =>
    ERRORS[code]?.[fr ? 0 : 1] ||
    (fr ? "Affectation bloquée." : "Placement blocked.");
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 text-foreground"
      aria-busy={busy || loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-5 w-5" />
          {fr ? "Affectation groupée" : "Bulk class placement"}
        </h3>
        <Button disabled={busy} onClick={onClose}>
          {fr ? "Fermer" : "Close"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {fr
          ? "Élèves sans classe uniquement · 100 maximum · Aucun transfert automatique."
          : "Unassigned students only · Up to 100 · No automatic transfers."}
      </p>
      {optionsError && (
        <p role="alert" className="text-danger">
          {fr
            ? "Impossible de charger les classes."
            : "Unable to load classes."}
        </p>
      )}
      <fieldset
        disabled={busy || optionsLoading}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="text-sm">
          {fr ? "Année scolaire" : "Academic year"}
          <select
            className="mt-1 block w-full rounded-lg border border-input p-2"
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setSectionId("");
              setPreview(null);
            }}
          >
            <option value="">
              {fr ? "Choisir une année" : "Choose a year"}
            </option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {label(y.name, y.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {fr ? "Classe" : "Class"}
          <select
            className="mt-1 block w-full rounded-lg border border-input p-2"
            disabled={!yearId || busy || optionsLoading}
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setPreview(null);
            }}
          >
            <option value="">
              {fr ? "Choisir une classe" : "Choose a class"}
            </option>
            {sections
              .filter((s) => s.academicYearId === yearId)
              .map((s) => (
                <option key={s.id} value={s.id} disabled={s.atCapacity}>
                  {sectionOptionLabel(s, locale, t)}
                </option>
              ))}
          </select>
        </label>
      </fieldset>
      {!optionsLoading && !sections.length && !optionsError && (
        <p className="text-sm text-muted-foreground">
          {fr
            ? "Configurez une année et ses classes dans Académie avant de continuer."
            : "Configure an academic year and classes in Academics first."}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
          setPage(1);
          reset();
          setRefresh((v) => v + 1);
        }}
      >
        <input
          aria-label={
            fr
              ? "Rechercher les élèves sans classe"
              : "Search unassigned students"
          }
          placeholder={fr ? "Nom ou code élève" : "Student name or code"}
          className="min-w-0 rounded-lg border border-input p-2"
          value={search}
          maxLength={120}
          onChange={(e) => setSearch(e.target.value)}
          disabled={busy}
        />
        <Button
          type="submit"
          disabled={busy}
          aria-label={fr ? "Rechercher" : "Search"}
        >
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-danger">
          {fr
            ? "Opération impossible. Revérifiez la sélection, les places et vos droits."
            : "Operation failed. Review selection, available seats and access."}
        </p>
      )}
      {result && (
        <p role="status" className="text-success">
          {fr
            ? `${result.assignedCount} élèves affectés, ${result.activatedCount} activés.`
            : `${result.assignedCount} students assigned, ${result.activatedCount} activated.`}
        </p>
      )}
      {loading ? (
        <p role="status">{fr ? "Chargement…" : "Loading…"}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button
              disabled={busy || !students.length}
              onClick={() => {
                setPreview(null);
                setResult(null);
                setIds((current) =>
                  Array.from(
                    new Set([...current, ...students.map((s) => s.id)]),
                  ).slice(0, 100),
                );
              }}
            >
              {fr ? "Sélectionner cette page" : "Select this page"}
            </Button>
            <Button disabled={busy || !ids.length} onClick={reset}>
              {fr ? "Effacer la sélection" : "Clear selection"}
            </Button>
            <span>
              {ids.length}/100 {fr ? "sélectionnés" : "selected"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {students.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(s.id)}
                  disabled={busy || (!ids.includes(s.id) && ids.length >= 100)}
                  onChange={() => toggle(s.id)}
                />
                <span>
                  {[s.firstName, s.lastName].filter(Boolean).join(" ")}{" "}
                  <span className="text-muted-foreground">{s.studentCode}</span>
                </span>
              </label>
            ))}
          </div>
          {!students.length && (
            <p className="text-sm text-muted-foreground">
              {fr
                ? "Aucun élève sans classe trouvé."
                : "No unassigned students found."}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button
              disabled={busy || page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              {fr ? "Précédent" : "Previous"}
            </Button>
            <span className="text-sm">
              {page}/{totalPages}
            </span>
            <Button
              disabled={busy || page >= totalPages}
              onClick={() => setPage((v) => v + 1)}
            >
              {fr ? "Suivant" : "Next"}
            </Button>
          </div>
        </>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={activate}
          disabled={busy}
          onChange={(e) => {
            setActivate(e.target.checked);
            setPreview(null);
          }}
        />
        {fr
          ? "Activer les élèves avec cette affectation"
          : "Activate students with this placement"}
      </label>
      <Button
        disabled={busy || loading || !ids.length || !sectionId || !yearId}
        onClick={() => void check()}
      >
        {fr ? "Prévisualiser l’affectation" : "Preview placement"}
      </Button>
      {preview && (
        <div className="space-y-3 border-t border-border pt-4">
          {preview.section && (
            <p className="text-sm">
              {label(preview.section.academicYearNameI18n, yearId)} ·{" "}
              {label(preview.section.nameI18n, preview.section.code)} ·{" "}
              {preview.selectedCount} {fr ? "élèves" : "students"} ·{" "}
              {preview.section.availableSeats === null
                ? fr
                  ? "Capacité non limitée"
                  : "Unlimited capacity"
                : fr
                  ? `${preview.section.availableSeats} places disponibles`
                  : `${preview.section.availableSeats} seats available`}
            </p>
          )}
          {preview.errors.map((code) => (
            <p key={code} role="alert" className="text-danger">
              {issue(code)}
            </p>
          ))}
          <PaginatedCollection items={preview.rows}>
            {(row) => (
              <div
                key={row.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <p>
                  {row.name || row.id} · {row.code}
                </p>
                {row.reasons.map((code) => (
                  <p key={code} className="text-danger">
                    {issue(code)}
                  </p>
                ))}
                <Button disabled={busy} onClick={() => toggle(row.id)}>
                  {fr ? "Retirer" : "Remove"}
                </Button>
              </div>
            )}
          </PaginatedCollection>
          {preview.ready && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => setDialog(true)}
            >
              {fr ? "Confirmer l’affectation" : "Confirm placement"}
            </Button>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={dialog}
        title={
          fr ? "Confirmer l’affectation groupée" : "Confirm bulk placement"
        }
        description={
          fr
            ? `${ids.length} élèves seront inscrits dans la classe choisie.${activate ? " Ils seront aussi activés." : ""}`
            : `${ids.length} students will be enrolled in the selected class.${activate ? " They will also be activated." : ""}`
        }
        confirmLabel={fr ? "Confirmer" : "Confirm"}
        cancelLabel={fr ? "Annuler" : "Cancel"}
        busy={busy}
        onConfirm={() => void commit()}
        onCancel={() => setDialog(false)}
      />
    </section>
  );
}
