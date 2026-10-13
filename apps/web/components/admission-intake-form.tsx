"use client";

import {
  Save,
  UserRound,
  UsersRound,
  GraduationCap,
  FileCheck2,
} from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { SectionSelectorClient } from "@/components/section-selector-client";
import { schoolActionClass } from "@/components/school-ui";

export function AdmissionIntakeForm({
  schoolId,
  values,
  onChange,
  sectionId,
  onSectionChange,
  documents,
  onDocumentChange,
  saving,
  onSubmit,
}: {
  schoolId: string;
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
  sectionId: string;
  onSectionChange: (value: string) => void;
  documents: Record<string, boolean>;
  onDocumentChange: (field: string, value: boolean) => void;
  saving: boolean;
  onSubmit: () => void;
}) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  function field(
    key: string,
    french: string,
    english: string,
    type = "text",
    required = false,
  ) {
    return (
      <label key={key} className="block text-sm font-medium text-slate-700">
        {fr ? french : english}
        {required ? " *" : ""}
        <input
          name={key}
          type={type}
          required={required}
          autoComplete="off"
          value={values[key] ?? ""}
          onChange={(event) => onChange(key, event.target.value)}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        />
      </label>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      aria-busy={saving}
    >
      <fieldset disabled={saving} className="space-y-5">
        <p className="text-sm text-slate-500">
          {fr
            ? "* Obligatoire. Le dossier créé reste une candidature."
            : "* Required. The created record remains an application."}
        </p>
        <section>
          <h4 className="flex items-center gap-2 font-semibold">
            <UserRound aria-hidden="true" size={18} />
            {fr ? "Candidat" : "Applicant"}
          </h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {field("firstName", "Prénom", "First name", "text", true)}
            {field("lastName", "Nom", "Last name", "text", true)}
            <label className="text-sm font-medium text-slate-700">
              {fr ? "Sexe" : "Gender"}
              <select
                value={values.gender ?? ""}
                onChange={(event) => onChange("gender", event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">{fr ? "Non précisé" : "Not specified"}</option>
                <option value="MALE">{fr ? "Garçon" : "Boy"}</option>
                <option value="FEMALE">{fr ? "Fille" : "Girl"}</option>
              </select>
            </label>
            {field("dateOfBirth", "Date de naissance", "Date of birth", "date")}
            {field("placeOfBirth", "Lieu de naissance", "Place of birth")}
          </div>
        </section>
        <section>
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <GraduationCap aria-hidden="true" size={18} />
            {fr ? "Classe souhaitée" : "Requested class"}
          </h4>
          <SectionSelectorClient
            schoolId={schoolId}
            sectionId={sectionId}
            onSectionIdChange={onSectionChange}
            label={fr ? "Classe / section *" : "Class / section *"}
            allowEmpty
            emptyLabel={fr ? "Choisir une classe" : "Choose a class"}
            emptyActionLabel={fr ? "Configurer" : "Configure"}
          />
        </section>
        <section>
          <h4 className="flex items-center gap-2 font-semibold">
            <UsersRound aria-hidden="true" size={18} />
            {fr ? "Responsable et contacts" : "Guardian and contacts"}
          </h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {field("parentFullName", "Nom du responsable", "Guardian name")}
            {field("parentPhone", "Téléphone", "Phone", "tel")}
            {field("parentEmail", "Courriel", "Email", "email")}
            {field("parentAddress", "Adresse", "Address")}
            {field(
              "emergencyContactName",
              "Contact d’urgence",
              "Emergency contact",
            )}
            {field(
              "emergencyContactPhone",
              "Téléphone d’urgence",
              "Emergency phone",
              "tel",
            )}
          </div>
        </section>
        <details className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer font-medium">
            {fr
              ? "École précédente et renseignements complémentaires"
              : "Previous school and additional details"}
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {field("previousSchoolName", "École précédente", "Previous school")}
            {field(
              "previousSchoolAddress",
              "Adresse de l’école précédente",
              "Previous school address",
            )}
            {field(
              "parentProfession",
              "Profession du responsable",
              "Guardian profession",
            )}
            <label className="block text-sm font-medium">
              {fr ? "Notes administratives" : "Administrative notes"}
              <textarea
                rows={3}
                value={values.notes ?? ""}
                onChange={(event) => onChange("notes", event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-3"
              />
            </label>
          </div>
        </details>
        <details className="rounded-xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer font-medium">
            <FileCheck2 aria-hidden="true" size={18} className="mr-2 inline" />
            {fr ? "Pièces reçues" : "Documents received"}
          </summary>
          <p className="mt-2 text-sm text-slate-500">
            {fr
              ? "Cochez seulement les pièces déjà reçues."
              : "Only mark documents already received."}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["photoReceived", "Photo", "Photo"],
              [
                "birthCertificateReceived",
                "Acte de naissance",
                "Birth certificate",
              ],
              [
                "vaccinationCardReceived",
                "Carte de vaccination",
                "Vaccination card",
              ],
              [
                "previousSchoolRecordReceived",
                "Dossier scolaire précédent",
                "Previous school record",
              ],
              [
                "parentIdDocumentReceived",
                "Pièce d’identité du responsable",
                "Guardian identification",
              ],
              [
                "conductCertificateReceived",
                "Certificat de conduite",
                "Conduct certificate",
              ],
            ].map(([key, french, english]) => (
              <label
                key={key}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={documents[key] ?? false}
                  onChange={(event) =>
                    onDocumentChange(key, event.target.checked)
                  }
                />
                {fr ? french : english}
              </label>
            ))}
          </div>
        </details>
        <button type="submit" className={schoolActionClass("primary")}>
          <Save aria-hidden="true" size={16} />
          {saving
            ? fr
              ? "Création…"
              : "Creating…"
            : fr
              ? "Créer la candidature"
              : "Create application"}
        </button>
      </fieldset>
    </form>
  );
}
