"use client";


import { platformErrorKey } from "@/lib/i18n/platform-copy";
import { usePlatformCopy } from "@/components/use-platform-copy";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, Plus, ArrowUpRight } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { ListPagination, useListPage } from "@/components/list-pagination";
import { filterPlatformSchools, platformLabel } from "@/lib/platform-presentation";
import {
  EmptyState,
  ManagementModeBadge,
  PlatformPanel,
  PlatformPrimaryLinkButton,
  PlatformStatCard,
  StatusBadge,
} from "@/components/platform-ui";

type School = {
  id: string;
  code: string;
  name: string;
  status: string;
  management_mode: "SELF_MANAGED" | "SUPERADMIN_MANAGED" | "HYBRID_MANAGED";
  default_locale: string;
  timezone: string;
  currency_code: string;
  country_code: string;
};

type PlatformSchoolsClientProps = {
  initialSchools: School[];
};

export function PlatformSchoolsClient({
  initialSchools,
}: PlatformSchoolsClientProps) {
  const pt = usePlatformCopy();

  const { locale } = useI18n();
  const fr = locale === "fr";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null);
  useEffect(() => {
    if (confirmDelete) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmDelete]);

  async function handleStatusAction(
    school: School,
    action: "activate" | "suspend" | "archive",
    newStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED",
  ) {
    if (working) return;
    if (!window.confirm(fr ? `Confirmer cette modification pour ${school.name} ?` : `Confirm this change for ${school.name}?`)) return;
    setWorking(school.id);
    setError("");

    try {
      const res = await fetch(
        `/api/proxy/platform/schools/${school.id}/${action}`,
        {
          method: "POST",
        },
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message ?? `Failed to ${action} school.`);
      }

      setSchools((prev) =>
        prev.map((s) => (s.id === school.id ? { ...s, status: newStatus } : s)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} school.`,
      );
    } finally {
      setWorking(null);
    }
  }

  async function handleDelete(school: School) {
    if (working || deleteCode !== school.code) return;
    setWorking(school.id);
    setError("");

    try {
      const res = await fetch(`/api/proxy/platform/schools/${school.id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Failed to delete school.");
      }

      setSchools((prev) => prev.filter((s) => s.id !== school.id));
      setConfirmDelete(null);
      setDeleteCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete school.");
    } finally {
      setWorking(null);
    }
  }

  const activeCount = schools.filter((s) => s.status === "ACTIVE").length;
  const setupCount = schools.filter((s) => s.status === "ACTIVE_SETUP").length;
  const visibleSchools = filterPlatformSchools(schools, search, status, mode);
  const schoolPage = useListPage(visibleSchools, JSON.stringify([search, status, mode]));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <PlatformStatCard label={fr ? "Écoles" : "Schools"} value={schools.length} />
        <PlatformStatCard label={fr ? "Actives" : "Active"} value={activeCount} />
        <PlatformStatCard label={fr ? "En configuration" : "In setup"} value={setupCount} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/40 bg-danger-subtle p-4 text-sm text-danger">
          {pt(platformErrorKey(error))}
        </div>
      ) : null}

      <PlatformPanel
        title={fr ? "Annuaire des écoles" : "School directory"}
        action={<PlatformPrimaryLinkButton href="/platform/schools/new"><Plus size={16} aria-hidden="true" />{fr ? "Nouvelle école" : "New school"}</PlatformPrimaryLinkButton>}
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-input bg-surface px-3 py-2"><Search size={17} aria-hidden="true" /><input aria-label={fr ? "Rechercher une école" : "Search schools"} placeholder={fr ? "Nom ou code…" : "Name or code…"} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <select aria-label={fr ? "Statut" : "Status"} value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 text-sm"><option value="">{fr ? "Tous les statuts" : "All statuses"}</option>{['DRAFT', 'ACTIVE_SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'].map(value => <option key={value} value={value}>{platformLabel(value, locale)}</option>)}</select>
          <select aria-label={fr ? "Gestion" : "Management"} value={mode} onChange={event => setMode(event.target.value)} className="rounded-lg border border-input bg-surface px-3 py-2 text-sm"><option value="">{fr ? "Tous les modes" : "All management modes"}</option>{['SELF_MANAGED', 'SUPERADMIN_MANAGED', 'HYBRID_MANAGED'].map(value => <option key={value} value={value}>{platformLabel(value, locale)}</option>)}</select>
          <span role="status" className="text-xs text-muted-foreground">{visibleSchools.length} / {schools.length}</span>
        </div>
        {schools.length === 0 ? (
          <EmptyState
            title={pt("No schools yet")}
            description={pt("Create the first school tenant to start operating the platform.")}
            action={
              <PlatformPrimaryLinkButton href="/platform/schools/new">
                {pt("Create School")}
              </PlatformPrimaryLinkButton>
            }
          />
        ) : visibleSchools.length === 0 ? <EmptyState title={fr ? "Aucun résultat" : "No matches"} description={fr ? "Modifiez vos filtres." : "Try different filters."} action={<button type="button" onClick={() => { setSearch(""); setStatus(""); setMode(""); }} className="rounded-lg border border-border px-3 py-2 text-sm">{fr ? "Réinitialiser" : "Reset filters"}</button>} /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{pt("Code")}</th>
                  <th className="px-4 py-3">{fr ? "École" : "School"}</th>
                  <th className="px-4 py-3">{fr ? "Statut" : "Status"}</th>
                  <th className="px-4 py-3">{fr ? "Gestion" : "Management"}</th>
                  <th className="hidden px-4 py-3 xl:table-cell">{fr ? "Langue" : "Language"}</th>
                  <th className="hidden px-4 py-3 2xl:table-cell">{fr ? "Fuseau" : "Timezone"}</th>
                  <th className="hidden px-4 py-3 xl:table-cell">{fr ? "Devise" : "Currency"}</th>
                  <th className="px-4 py-3">{pt("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {schoolPage.items.map((school) => {
                  const busy = working !== null;

                  return (
                    <tr key={school.id} className="border-t border-border">
                      <td className="px-4 py-3 font-mono text-xs">{school.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {school.name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={school.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ManagementModeBadge mode={school.management_mode} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{school.default_locale}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground 2xl:table-cell">{school.timezone}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{school.currency_code}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/platform/schools/${school.id}`}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                          >
                            <span className="inline-flex items-center gap-1">{fr ? "Ouvrir" : "Open"}<ArrowUpRight size={14} aria-hidden="true" /></span>
                          </Link>

                          {school.status === "SUSPENDED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "activate", "ACTIVE")
                              }
                              className="rounded-lg border border-success/40 bg-success-subtle px-3 py-1.5 text-xs font-medium text-success hover:bg-success-subtle disabled:opacity-50"
                            >
                              {busy ? "..." : pt("Reactivate")}
                            </button>
                          ) : school.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "suspend", "SUSPENDED")
                              }
                              className="rounded-lg border border-warning/40 bg-warning-subtle px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning-subtle disabled:opacity-50"
                            >
                              {busy ? "..." : pt("Suspend")}
                            </button>
                          ) : null}

                          {school.status !== "ARCHIVED" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                handleStatusAction(school, "archive", "ARCHIVED")
                              }
                              className="rounded-lg border border-input bg-surface text-foreground px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
                            >
                              {busy ? "..." : pt("Archive")}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => { setDeleteCode(""); setConfirmDelete(school); }}
                            className="rounded-lg border border-danger/40 bg-danger-subtle px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-subtle disabled:opacity-50"
                          >
                            {fr ? "Supprimer" : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PlatformPanel>
      <ListPagination {...schoolPage} disabled={!!working} />

      {confirmDelete ? (
        <dialog ref={dialog} aria-labelledby="delete-school-title" onCancel={event => { event.preventDefault(); if (!working) setConfirmDelete(null); }} onClose={() => setConfirmDelete(null)} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-6 text-foreground shadow-lg backdrop:bg-black/50">
            <h2 id="delete-school-title" className="text-lg font-semibold text-foreground">{fr ? "Supprimer cette école ?" : "Delete this school?"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium">{confirmDelete.name}</span> (
              {confirmDelete.code}). {fr ? "Confirmez le retrait de cette école de la plateforme." : "Confirm removal of this school from the platform."}
            </p>
            <label className="mt-4 block text-sm">{fr ? "Saisissez le code pour confirmer" : "Type the school code to confirm"}<input value={deleteCode} onChange={event => setDeleteCode(event.target.value)} disabled={!!working} className="mt-2 w-full rounded-lg border border-input bg-surface px-3 py-2" /></label>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void handleDelete(confirmDelete)}
                disabled={!!working || deleteCode !== confirmDelete.code}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {fr ? "Supprimer" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={!!working}
                className="flex-1 rounded-xl border border-input py-2.5 text-sm font-medium hover:bg-surface-muted"
              >
                {fr ? "Annuler" : "Cancel"}
              </button>
            </div>
        </dialog>
      ) : null}
    </div>
  );
}
