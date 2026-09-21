"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { SectionSelectorClient } from "@/components/section-selector-client";

const IDENTITY_FIELDS = [
  ["firstName", "Prénom", "First name"],
  ["lastName", "Nom", "Last name"],
  ["dateOfBirth", "Date de naissance", "Date of birth"],
  ["placeOfBirth", "Lieu de naissance", "Place of birth"],
  ["previousSchoolName", "École précédente", "Previous school"],
  [
    "previousSchoolAddress",
    "Adresse de l’école précédente",
    "Previous school address",
  ],
] as const;
const PARENT_FIELDS = [
  ["parentFullName", "Nom du responsable", "Guardian name"],
  ["parentPhone", "Téléphone", "Phone"],
  ["parentEmail", "Courriel", "Email"],
  ["parentAddress", "Adresse", "Address"],
  ["emergencyContactName", "Contact d’urgence", "Emergency contact"],
  ["emergencyContactPhone", "Téléphone d’urgence", "Emergency phone"],
] as const;

/** Deliberately separate from the medical, financial and decision-making forms. */
export function OfficeRecordClient({
  schoolId,
  kind,
  recordId,
  onSaved,
}: {
  schoolId: string;
  kind: "student" | "admission";
  recordId?: string;
  onSaved?: () => void;
}) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const base = kind === "student" ? "school-students" : "admissions";
  const [values, setValues] = useState<Record<string, string>>({});
  const [sectionId, setSectionId] = useState("");
  const [loading, setLoading] = useState(Boolean(recordId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fields =
    kind === "student"
      ? IDENTITY_FIELDS
      : [...IDENTITY_FIELDS, ...PARENT_FIELDS];

  useEffect(() => {
    if (!recordId) return;
    const abort = new AbortController();
    void fetch(
      `/api/${base}/${encodeURIComponent(recordId)}?${new URLSearchParams({ schoolId })}`,
      { cache: "no-store", signal: abort.signal },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body?.message === "string"
              ? body.message
              : "Unable to load record.",
          );
        const source = kind === "student" ? body.student : body.candidate;
        const next: Record<string, string> = {};
        for (const [key] of IDENTITY_FIELDS) next[key] = source?.[key] ?? "";
        next.gender = source?.gender ?? "";
        if (kind === "admission") {
          next.parentFullName = body.parent?.fullName ?? "";
          next.parentPhone = body.parent?.phone ?? "";
          next.parentEmail = body.parent?.email ?? "";
          next.parentAddress = body.parent?.address ?? "";
          next.emergencyContactName = body.emergencyContact?.name ?? "";
          next.emergencyContactPhone = body.emergencyContact?.phone ?? "";
          setSectionId(body.desiredSection?.id ?? "");
        }
        setValues(next);
      })
      .catch((caught: unknown) => {
        if (!abort.signal.aborted)
          setError(
            caught instanceof Error ? caught.message : "Unable to load record.",
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [base, kind, recordId, schoolId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: Record<string, string> = { schoolId };
      for (const [key] of fields) {
        const value = (values[key] ?? "").trim();
        if (
          value ||
          (recordId && key !== "dateOfBirth" && key !== "parentEmail")
        )
          payload[key] = value;
      }
      if (values.gender) payload.gender = values.gender;
      if (kind === "admission" && sectionId)
        payload.desiredSectionId = sectionId;
      const response = await fetch(
        `/api/${base}${recordId ? `/${encodeURIComponent(recordId)}` : ""}`,
        {
          method: recordId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : fr
              ? "Enregistrement impossible."
              : "Unable to save.",
        );
      setSaved(true);
      if (!recordId) {
        setValues({});
        setSectionId("");
      }
      onSaved?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href={kind === "student" ? "/students" : "/admissions"}
        className="inline-flex items-center gap-2 text-sm text-blue-700"
      >
        <ArrowLeft size={16} />
        {fr ? "Retour à la liste" : "Back to directory"}
      </Link>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-green-700">
          {fr ? "Enregistrement effectué." : "Record saved."}
        </p>
      )}
      <form
        onSubmit={save}
        className="rounded-2xl border border-slate-200 bg-white p-5"
      >
        <fieldset
          disabled={
            loading ||
            saving ||
            Boolean(recordId && error && !Object.keys(values).length)
          }
          className="space-y-4 disabled:opacity-60"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(([key, french, english]) => (
              <label key={key} className="text-sm font-medium">
                {fr ? french : english}
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  type={
                    key === "dateOfBirth"
                      ? "date"
                      : key === "parentEmail"
                        ? "email"
                        : "text"
                  }
                  required={key === "firstName" || key === "lastName"}
                  maxLength={key.includes("Address") ? 500 : 120}
                  value={values[key] ?? ""}
                  onChange={(event) => {
                    setSaved(false);
                    setValues({ ...values, [key]: event.target.value });
                  }}
                />
              </label>
            ))}
            <label className="text-sm font-medium">
              {fr ? "Sexe" : "Gender"}
              <select
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                value={values.gender ?? ""}
                onChange={(event) =>
                  setValues({ ...values, gender: event.target.value })
                }
              >
                <option value="">—</option>
                <option value="FEMALE">{fr ? "Féminin" : "Female"}</option>
                <option value="MALE">{fr ? "Masculin" : "Male"}</option>
              </select>
            </label>
          </div>
          {kind === "admission" && (
            <SectionSelectorClient
              schoolId={schoolId}
              sectionId={sectionId}
              onSectionIdChange={setSectionId}
              allowEmpty
              allowFullSectionId={sectionId}
              emptyActionHref="/admissions"
              emptyActionLabel={fr ? "Retour" : "Back"}
            />
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-white"
          >
            <Save size={16} />
            {loading
              ? fr
                ? "Chargement…"
                : "Loading…"
              : saving
                ? fr
                  ? "Enregistrement…"
                  : "Saving…"
                : fr
                  ? "Enregistrer"
                  : "Save"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
