"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, RefreshCw, Eye, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { AdmissionIntakeForm } from "@/components/admission-intake-form";
import { OfficeRecordClient } from "@/components/office-record-client";
import {
  SchoolBadge,
  EmptySchoolState,
  schoolActionClass,
  type SchoolBadgeTone,
} from "@/components/school-ui";

type AdmissionApplicationRow = {
  id: string;
  applicationNumber: string;
  admissionStatus: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  parentFullName: string | null;
  parentPhone: string | null;
  desiredGradeLevelCode: string | null;
  desiredGradeLevelNameI18n: Record<string, string> | null;
  desiredSectionCode: string | null;
  desiredSectionNameI18n: Record<string, string> | null;
  createdAt: string;
};

const ADMISSION_STATUSES = [
  "PROSPECT",
  "APPLICATION_SUBMITTED",
  "DOCUMENTS_INCOMPLETE",
  "PENDING_PAYMENT",
  "PENDING_EXAM",
  "EXAM_SCHEDULED",
  "ADMITTED",
  "CONDITIONALLY_ADMITTED",
  "WAITLISTED",
  "REJECTED",
  "CONFIRMED",
  "CONVERTED_TO_STUDENT",
  "CANCELLED",
];

function admissionStatusLabel(status: string, locale: "fr" | "en" = "fr") {
  if (locale === "en")
    return status
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (value) => value.toUpperCase());
  const labels: Record<string, string> = {
    PROSPECT: "Prospect",
    APPLICATION_SUBMITTED: "Demande soumise",
    DOCUMENTS_INCOMPLETE: "Documents incomplets",
    PENDING_PAYMENT: "En attente de paiement",
    PENDING_EXAM: "En attente d'examen",
    EXAM_SCHEDULED: "Examen planifié",
    ADMITTED: "Admis",
    CONDITIONALLY_ADMITTED: "Admis sous condition",
    WAITLISTED: "Liste d'attente",
    REJECTED: "Refusé",
    CONFIRMED: "Confirmé",
    CONVERTED_TO_STUDENT: "Converti en élève",
    CANCELLED: "Annulé",
  };

  return labels[status] ?? status;
}

function admissionStatusTone(status: string): SchoolBadgeTone {
  if (status === "ADMITTED" || status === "CONFIRMED") return "green";
  if (status === "REJECTED" || status === "CANCELLED") return "red";
  if (status === "DOCUMENTS_INCOMPLETE" || status === "PENDING_PAYMENT") {
    return "amber";
  }
  if (status === "CONVERTED_TO_STUDENT") return "neutral";
  return "blue";
}

function i18nName(
  value: Record<string, string> | null | undefined,
  fallback: string,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? fallback;
}

function desiredClassLabel(row: AdmissionApplicationRow, locale: "fr" | "en") {
  const grade = i18nName(
    row.desiredGradeLevelNameI18n,
    row.desiredGradeLevelCode ?? "",
    locale,
  );

  const section = i18nName(
    row.desiredSectionNameI18n,
    row.desiredSectionCode ?? "",
    locale,
  );

  const label =
    grade && section.toLowerCase().includes(grade.toLowerCase())
      ? section
      : [grade, section].filter(Boolean).join(" - ");
  return label || (locale === "fr" ? "Non choisie" : "Not selected");
}

export function AdmissionsClient({
  schoolId,
  canCreate,
  officeOnly = false,
}: {
  schoolId: string;
  canCreate: boolean;
  officeOnly?: boolean;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const fr = locale === "fr";
  const requestRef = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const [rows, setRows] = useState<AdmissionApplicationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openCreate, setOpenCreate] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [previousSchoolName, setPreviousSchoolName] = useState("");
  const [previousSchoolAddress, setPreviousSchoolAddress] = useState("");
  const [desiredSectionId, setDesiredSectionId] = useState("");

  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentProfession, setParentProfession] = useState("");
  const [parentAddress, setParentAddress] = useState("");

  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");

  const [photoReceived, setPhotoReceived] = useState(false);
  const [birthCertificateReceived, setBirthCertificateReceived] =
    useState(false);
  const [vaccinationCardReceived, setVaccinationCardReceived] = useState(false);
  const [previousSchoolRecordReceived, setPreviousSchoolRecordReceived] =
    useState(false);
  const [parentIdDocumentReceived, setParentIdDocumentReceived] =
    useState(false);
  const [conductCertificateReceived, setConductCertificateReceived] =
    useState(false);

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [structureReady, setStructureReady] = useState(false);
  const [structureLoading, setStructureLoading] = useState(false);
  const [structureMessage, setStructureMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAcademicStructureStatus() {
    setStructureLoading(true);
    setStructureMessage("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/academic/section-options?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof body?.message === "string"
            ? body.message
            : fr
              ? "Impossible de vérifier les classes. Réessayez."
              : "Unable to verify classes. Try again.",
        );
      }

      if (!Array.isArray(body))
        throw new Error(
          fr
            ? "Réponse des classes invalide. Réessayez."
            : "Invalid class response. Try again.",
        );
      const totalSections = body.length;

      setStructureReady(totalSections > 0);

      if (totalSections === 0) {
        setStructureMessage(
          fr
            ? "Aucune classe disponible. Configurez les classes et sections avant de créer une candidature."
            : "No classes are available. Configure classes and sections before creating applications.",
        );
      }
    } catch (err) {
      setStructureReady(false);
      setStructureMessage(
        err instanceof Error
          ? err.message
          : "Failed to verify academic structure.",
      );
    } finally {
      setStructureLoading(false);
    }
  }

  async function loadApplications() {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (status) {
        params.set("status", status);
      }

      const res = await fetch(`/api/admissions?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admissions.");
      }

      if (!Array.isArray(body))
        throw new Error(
          fr
            ? "Réponse du répertoire invalide."
            : "Invalid directory response.",
        );
      if (!controller.signal.aborted) setRows(body);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(
        err instanceof Error ? err.message : "Failed to load admissions.",
      );
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }

  async function createApplication() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (!firstName.trim() || !lastName.trim()) {
        throw new Error(
          fr
            ? "Le prénom et le nom sont obligatoires."
            : "First name and last name are required.",
        );
      }

      if (!desiredSectionId) {
        throw new Error(
          fr
            ? "Choisissez la classe souhaitée."
            : "Desired class / section is required.",
        );
      }

      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolId,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          gender: gender || undefined,
          dateOfBirth: dateOfBirth || undefined,
          placeOfBirth,
          previousSchoolName,
          previousSchoolAddress,
          desiredSectionId: desiredSectionId || undefined,
          parentFullName,
          parentPhone,
          parentEmail: parentEmail || undefined,
          parentProfession,
          parentAddress,
          emergencyContactName,
          emergencyContactPhone,
          photoReceived,
          birthCertificateReceived,
          vaccinationCardReceived,
          previousSchoolRecordReceived,
          parentIdDocumentReceived,
          conductCertificateReceived,
          notes,
        }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          body?.message ?? "Failed to create admission application.",
        );
      }

      setMessage(
        `${fr ? "Candidature créée" : "Application created"}: ${body.applicationNumber}`,
      );
      setOpenCreate(false);

      setFirstName("");
      setLastName("");
      setGender("");
      setDateOfBirth("");
      setPlaceOfBirth("");
      setPreviousSchoolName("");
      setPreviousSchoolAddress("");
      setDesiredSectionId("");
      setParentFullName("");
      setParentPhone("");
      setParentEmail("");
      setParentProfession("");
      setParentAddress("");
      setEmergencyContactName("");
      setEmergencyContactPhone("");
      setPhotoReceived(false);
      setBirthCertificateReceived(false);
      setVaccinationCardReceived(false);
      setPreviousSchoolRecordReceived(false);
      setParentIdDocumentReceived(false);
      setConductCertificateReceived(false);
      setNotes("");

      if (typeof body?.id === "string")
        router.push(`/admissions/${encodeURIComponent(body.id)}`);

      await loadApplications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create admission application.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (canCreate && !officeOnly) loadAcademicStructureStatus();
    return () => requestRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadApplications(), 300);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, search, status]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {fr ? "Candidatures" : "Applications"}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {fr
                ? "Suivez les candidatures avant leur inscription définitive."
                : "Track applications before enrollment."}
            </p>
          </div>

          {canCreate ? (
            <button
              type="button"
              disabled={
                saving || (!officeOnly && (!structureReady || structureLoading))
              }
              onClick={() => setOpenCreate((value) => !value)}
              className={schoolActionClass("primary")}
            >
              <Plus aria-hidden="true" size={16} />
              {structureLoading
                ? fr
                  ? "Vérification…"
                  : "Checking…"
                : openCreate
                  ? fr
                    ? "Fermer le formulaire"
                    : "Close form"
                  : fr
                    ? "Nouvelle candidature"
                    : "New application"}
            </button>
          ) : null}
        </div>

        {message ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        {!structureReady && structureMessage ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="font-semibold">
              {fr
                ? "Structure scolaire requise"
                : "Academic structure required"}
            </div>
            <div className="mt-1">{structureMessage}</div>

            <a
              href="/academic-structure"
              className="mt-3 inline-flex rounded-lg bg-amber-700 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800"
            >
              {fr ? "Configurer les classes" : "Configure classes"}
            </a>
            <button
              type="button"
              onClick={() => void loadAcademicStructureStatus()}
              disabled={structureLoading}
              className="ml-2 underline"
            >
              {fr ? "Réessayer" : "Try again"}
            </button>
          </div>
        ) : null}

        {openCreate && canCreate && officeOnly ? (
          <OfficeRecordClient
            schoolId={schoolId}
            kind="admission"
            onSaved={() => {
              setOpenCreate(false);
              void loadApplications();
            }}
          />
        ) : null}
        {openCreate && canCreate && !officeOnly ? (
          <AdmissionIntakeForm
            schoolId={schoolId}
            values={{
              firstName,
              lastName,
              gender,
              dateOfBirth,
              placeOfBirth,
              previousSchoolName,
              previousSchoolAddress,
              parentFullName,
              parentPhone,
              parentEmail,
              parentProfession,
              parentAddress,
              emergencyContactName,
              emergencyContactPhone,
              notes,
            }}
            onChange={(field, value) => {
              const setters: Record<string, (value: string) => void> = {
                firstName: setFirstName,
                lastName: setLastName,
                gender: setGender,
                dateOfBirth: setDateOfBirth,
                placeOfBirth: setPlaceOfBirth,
                previousSchoolName: setPreviousSchoolName,
                previousSchoolAddress: setPreviousSchoolAddress,
                parentFullName: setParentFullName,
                parentPhone: setParentPhone,
                parentEmail: setParentEmail,
                parentProfession: setParentProfession,
                parentAddress: setParentAddress,
                emergencyContactName: setEmergencyContactName,
                emergencyContactPhone: setEmergencyContactPhone,
                notes: setNotes,
              };
              setters[field]?.(value);
            }}
            sectionId={desiredSectionId}
            onSectionChange={setDesiredSectionId}
            documents={{
              photoReceived,
              birthCertificateReceived,
              vaccinationCardReceived,
              previousSchoolRecordReceived,
              parentIdDocumentReceived,
              conductCertificateReceived,
            }}
            onDocumentChange={(field, value) => {
              const setters: Record<string, (value: boolean) => void> = {
                photoReceived: setPhotoReceived,
                birthCertificateReceived: setBirthCertificateReceived,
                vaccinationCardReceived: setVaccinationCardReceived,
                previousSchoolRecordReceived: setPreviousSchoolRecordReceived,
                parentIdDocumentReceived: setParentIdDocumentReceived,
                conductCertificateReceived: setConductCertificateReceived,
              };
              setters[field]?.(value);
            }}
            saving={saving}
            onSubmit={() => void createApplication()}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">
              {fr ? "Répertoire des candidatures" : "Application directory"}
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              {fr
                ? "Numéro, candidat, responsable ou téléphone."
                : "Number, applicant, guardian or phone."}
            </p>
          </div>

          <button
            type="button"
            onClick={loadApplications}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw aria-hidden="true" size={16} className="mr-1 inline" />
            {loading
              ? fr
                ? "Chargement…"
                : "Loading…"
              : fr
                ? "Actualiser"
                : "Refresh"}
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void loadApplications();
          }}
          className="mb-4 flex flex-wrap items-end gap-3"
        >
          <label className="min-w-0 flex-1 text-sm font-medium">
            {fr ? "Rechercher" : "Search"}
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder={
                fr ? "Nom, numéro ou téléphone" : "Name, number or phone"
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            {fr ? "Statut" : "Status"}
            <select
              className="mt-1 block min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">
                {fr ? "Tous les statuts" : "All statuses"}
              </option>
              {ADMISSION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {admissionStatusLabel(item, locale)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className={schoolActionClass()}
          >
            <Search aria-hidden="true" size={16} />
            {fr ? "Rechercher" : "Search"}
          </button>
          {search || status ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
              }}
              className={schoolActionClass()}
            >
              <X aria-hidden="true" size={16} />
              {fr ? "Effacer" : "Clear"}
            </button>
          ) : null}
        </form>

        <div
          aria-busy={loading}
          className="overflow-x-auto rounded-2xl border border-slate-200"
        >
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">
                  {fr ? "Candidature" : "Application"}
                </th>
                <th className="px-4 py-3">{fr ? "Candidat" : "Applicant"}</th>
                <th className="px-4 py-3">
                  {fr ? "Classe souhaitée" : "Requested class"}
                </th>
                <th className="px-4 py-3">{fr ? "Responsable" : "Guardian"}</th>
                <th className="px-4 py-3">{fr ? "Statut" : "Status"}</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {row.applicationNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {row.firstName} {row.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.gender === "MALE"
                        ? "Boy / Garcon"
                        : row.gender === "FEMALE"
                          ? "Girl / Fille"
                          : "-"}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {desiredClassLabel(row, locale)}
                  </td>

                  <td className="px-4 py-3">
                    <div>{row.parentFullName ?? "-"}</div>
                    <div className="text-xs text-slate-500">
                      {row.parentPhone ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <SchoolBadge
                      tone={admissionStatusTone(row.admissionStatus)}
                    >
                      {admissionStatusLabel(row.admissionStatus, locale)}
                    </SchoolBadge>
                  </td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/admissions/${row.id}`}
                      className={schoolActionClass()}
                    >
                      <Eye aria-hidden="true" size={16} />
                      {fr ? "Ouvrir" : "Open"}
                    </Link>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && !loading && !error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    <EmptySchoolState
                      title={
                        fr
                          ? "Aucune candidature trouvée"
                          : "No applications found"
                      }
                      description={
                        search || status
                          ? fr
                            ? "Modifiez la recherche ou effacez les filtres."
                            : "Change the search or clear filters."
                          : fr
                            ? "Les candidatures créées apparaîtront ici."
                            : "Created applications will appear here."
                      }
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {loading ? (
          <p role="status" className="mt-3 text-sm text-slate-500">
            {fr ? "Chargement des candidatures…" : "Loading applications…"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
