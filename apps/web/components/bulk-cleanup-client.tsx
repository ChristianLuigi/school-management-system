"use client";
import { useEffect, useState } from "react";
import { Trash2, Search } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PaginatedCollection } from "@/components/paginated-collection";

type RecordItem = { id: string; name: string; code: string | null };
type Preview = {
  rows: (RecordItem & { eligible: boolean; reasons: string[] })[];
  ready: boolean;
  eligibleCount: number;
  blockedCount: number;
};
const REASONS: Record<string, [string, string]> = {
  NOT_AVAILABLE: [
    "Fiche indisponible dans cette école.",
    "Record unavailable in this school.",
  ],
  PROTECTED_STATUS: [
    "Statut protégé : utilisez le workflow d’archivage.",
    "Protected status: use the archival workflow.",
  ],
  PROTECTED_HISTORY: [
    "Historique ou dépendances protégés.",
    "Protected history or dependencies.",
  ],
  LOGIN_ACCOUNT: [
    "Compte de connexion ou accès parent lié.",
    "Linked login account or parent access.",
  ],
  STUDENT_LINK: [
    "Responsable encore associé à un élève.",
    "Guardian still linked to a student.",
  ],
};

export function BulkCleanupClient({
  schoolId,
  onClose,
  onDeleted,
}: {
  schoolId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const [kind, setKind] = useState<"students" | "guardians">("students");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [dialog, setDialog] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(false);
    setRows([]);
    const params = new URLSearchParams({
      schoolId,
      kind,
      search: applied,
      page: String(page),
    });
    void fetch(`/api/school-students/cleanup?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((body) => {
        if (active) {
          setRows(body.rows);
          setHasNext(body.hasNext);
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
  }, [schoolId, kind, applied, page, refresh]);
  function resetSelection() {
    setIds([]);
    setPreview(null);
    setConfirmation("");
    setDone(null);
  }
  function toggle(id: string) {
    setPreview(null);
    setConfirmation("");
    setDone(null);
    setIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 100
          ? [...current, id]
          : current,
    );
  }
  async function check() {
    setBusy(true);
    setError(false);
    setDone(null);
    try {
      const r = await fetch("/api/school-students/cleanup/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, kind, ids }),
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
      const r = await fetch("/api/school-students/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, kind, ids, reason, confirmation }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        if (body?.preview) setPreview(body.preview);
        throw new Error();
      }
      resetSelection();
      setDone(body.deletedCount);
      setReason("");
      setRefresh((value) => value + 1);
      onDeleted();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      setDialog(false);
    }
  }
  return (
    <section
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 text-foreground"
      aria-busy={busy || loading}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">
          {fr ? "Suppression groupée ciblée" : "Targeted bulk deletion"}
        </h3>
        <Button disabled={busy} onClick={onClose}>
          {fr ? "Fermer" : "Close"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {fr
          ? "Uniquement les fiches inutilisées. Les historiques et comptes liés sont protégés. Suppression logique, récupérable par le support."
          : "Unused records only. History and linked accounts are protected. Soft deletion, recoverable by support."}
      </p>
      <fieldset disabled={busy} className="flex flex-wrap gap-3">
        <label className="text-sm">
          {fr ? "Type de fiche" : "Record type"}
          <select
            className="ml-2 rounded-lg border border-input p-2"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              setPage(1);
              resetSelection();
            }}
          >
            <option value="students">{fr ? "Élèves" : "Students"}</option>
            <option value="guardians">
              {fr ? "Responsables" : "Guardians"}
            </option>
          </select>
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
            setPage(1);
            resetSelection();
            setRefresh((value) => value + 1);
          }}
        >
          <input
            aria-label={
              fr ? "Rechercher par nom ou code" : "Search by name or code"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={fr ? "Nom ou code" : "Name or code"}
            maxLength={100}
            className="rounded-lg border border-input p-2"
          />
          <Button type="submit" aria-label={fr ? "Rechercher" : "Search"}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </fieldset>
      {error && (
        <p role="alert" className="text-danger">
          {fr
            ? "Opération impossible. Vérifiez les accès et la prévisualisation, puis réessayez."
            : "Operation failed. Check access and the preview, then retry."}
        </p>
      )}
      {done !== null && (
        <p role="status" className="text-success">
          {fr
            ? `${done} fiches supprimées logiquement.`
            : `${done} records soft-deleted.`}
        </p>
      )}
      {loading ? (
        <p role="status">{fr ? "Chargement…" : "Loading…"}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button
              disabled={busy || !rows.length}
              onClick={() => {
                setPreview(null);
                setConfirmation("");
                setIds((current) =>
                  Array.from(
                    new Set([...current, ...rows.map((r) => r.id)]),
                  ).slice(0, 100),
                );
              }}
            >
              {fr ? "Sélectionner cette page" : "Select this page"}
            </Button>
            <Button disabled={busy || !ids.length} onClick={resetSelection}>
              {fr ? "Effacer la sélection" : "Clear selection"}
            </Button>
            <span>
              {ids.length}/100 {fr ? "sélectionnées" : "selected"}
            </span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <label
                key={row.id}
                className="flex cursor-pointer items-center gap-3 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={ids.includes(row.id)}
                  disabled={
                    busy || (!ids.includes(row.id) && ids.length >= 100)
                  }
                  onChange={() => toggle(row.id)}
                />
                <span>
                  {row.name}{" "}
                  <span className="text-muted-foreground">{row.code}</span>
                </span>
              </label>
            ))}
          </div>
          {!rows.length && (
            <p className="text-sm text-muted-foreground">
              {fr ? "Aucune fiche trouvée." : "No records found."}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={busy || page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {fr ? "Précédent" : "Previous"}
            </Button>
            <span className="self-center text-sm">{page}</span>
            <Button
              disabled={busy || !hasNext}
              onClick={() => setPage((value) => value + 1)}
            >
              {fr ? "Suivant" : "Next"}
            </Button>
          </div>
        </>
      )}
      <Button
        disabled={busy || loading || !ids.length}
        onClick={() => void check()}
      >
        {fr ? "Vérifier la sélection" : "Review selection"}
      </Button>
      {preview && (
        <div className="space-y-3 border-t border-border pt-4">
          <p role="status">
            {preview.eligibleCount} {fr ? "autorisées" : "eligible"} ·{" "}
            {preview.blockedCount} {fr ? "bloquées" : "blocked"}
          </p>
          <PaginatedCollection items={preview.rows}>
            {(row) => (
              <div
                key={row.id}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <p>
                  {row.name || row.id} · {row.code}
                </p>
                {row.eligible ? (
                  <p className="text-success">
                    {fr ? "Suppression autorisée" : "Eligible for deletion"}
                  </p>
                ) : (
                  row.reasons.map((code) => (
                    <p key={code} className="text-danger">
                      {REASONS[code]?.[fr ? 0 : 1] ??
                        (fr ? "Fiche protégée." : "Protected record.")}
                    </p>
                  ))
                )}
                <Button disabled={busy} onClick={() => toggle(row.id)}>
                  {fr ? "Retirer de la sélection" : "Remove from selection"}
                </Button>
              </div>
            )}
          </PaginatedCollection>
          {preview.ready && (
            <>
              <label className="block text-sm">
                {fr
                  ? "Motif (10 caractères minimum)"
                  : "Reason (at least 10 characters)"}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={busy}
                  minLength={10}
                  maxLength={500}
                  className="mt-1 block w-full rounded-lg border border-input p-2"
                />
              </label>
              <label className="block text-sm">
                {fr ? "Tapez DELETE pour confirmer" : "Type DELETE to confirm"}
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                  className="mt-1 block rounded-lg border border-input p-2"
                />
              </label>
              <Button
                variant="danger"
                disabled={
                  busy || confirmation !== "DELETE" || reason.trim().length < 10
                }
                onClick={() => setDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                {fr ? "Supprimer la sélection" : "Delete selection"}
              </Button>
            </>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={dialog}
        title={
          fr ? "Confirmer la suppression groupée" : "Confirm bulk deletion"
        }
        description={
          fr
            ? `${ids.length} fiches seront masquées. Aucun effacement définitif. Continuer ?`
            : `${ids.length} records will be hidden, not permanently erased. Continue?`
        }
        confirmLabel={fr ? "Confirmer" : "Confirm"}
        cancelLabel={fr ? "Annuler" : "Cancel"}
        destructive
        busy={busy}
        onConfirm={() => void commit()}
        onCancel={() => setDialog(false)}
      />
    </section>
  );
}
