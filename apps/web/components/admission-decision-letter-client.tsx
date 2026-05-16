"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolBadge } from "@/components/school-ui";
import {
  admissionStatusLabel,
  admissionStatusTone,
} from "@/components/admission-status-panel-client";

type AdmissionDecisionLetterDetails = {
  id: string;
  schoolId: string;
  school: {
    name: string;
    code: string | null;
  };
  applicationNumber: string;
  admissionStatus: string;
  academicYear: {
    id: string;
    nameI18n: Record<string, string> | null;
  } | null;
  desiredGradeLevel: {
    id: string;
    code: string | null;
    nameI18n: Record<string, string> | null;
  } | null;
  desiredSection: {
    id: string;
    code: string | null;
    nameI18n: Record<string, string> | null;
  } | null;
  candidate: {
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    previousSchoolName: string | null;
  };
  parent: {
    fullName: string | null;
    phone: string | null;
    email: string | null;
  };
  documents: {
    photoReceived: boolean;
    birthCertificateReceived: boolean;
    vaccinationCardReceived: boolean;
    previousSchoolRecordReceived: boolean;
    parentIdDocumentReceived: boolean;
    conductCertificateReceived: boolean;
  };
  registrationFee: {
    required: boolean;
    amount: number;
    currencyCode: string;
    status: string;
    receiptNumber: string | null;
  };
  exam: {
    examStatus: string;
    totalScore: number | null;
    maxScore: number;
    decisionStatus: string | null;
  } | null;
  notes: string | null;
  createdAt: string;
};

function i18nName(value: Record<string, string> | null | undefined, fallback: string) {
  return value?.fr ?? value?.en ?? fallback;
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);
}

function documentStatus(received: boolean) {
  return received ? "Recu" : "Manquant";
}

function feeStatusLabel(status: string) {
  const labels: Record<string, string> = {
    NOT_REQUIRED: "Non requis",
    PENDING: "En attente",
    PAID: "Paye",
    WAIVED: "Exonere",
    REFUNDED: "Rembourse",
  };

  return labels[status] ?? status;
}

function isPrintableDecision(status: string) {
  return ["ADMITTED", "CONDITIONALLY_ADMITTED", "CONFIRMED"].includes(status);
}

export function AdmissionDecisionLetterClient({
  schoolId,
  admissionApplicationId,
}: {
  schoolId: string;
  admissionApplicationId: string;
}) {
  const [application, setApplication] =
    useState<AdmissionDecisionLetterDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadApplication() {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ schoolId });

      const res = await fetch(
        `/api/admissions/${admissionApplicationId}?${params.toString()}`,
        { cache: "no-store" },
      );

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.message ?? "Failed to load admission letter.");
      }

      setApplication(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load admission letter.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, admissionApplicationId]);

  const desiredClass = application
    ? [
        application.desiredGradeLevel
          ? i18nName(
              application.desiredGradeLevel.nameI18n,
              application.desiredGradeLevel.code ?? "",
            )
          : "",
        application.desiredSection
          ? i18nName(
              application.desiredSection.nameI18n,
              application.desiredSection.code ?? "",
            )
          : "",
      ]
        .filter(Boolean)
        .join(" - ") || "-"
    : "-";

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admissions/${admissionApplicationId}`}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Back to Admission
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={
            application ? !isPrintableDecision(application.admissionStatus) : true
          }
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Print / Save as PDF
        </button>
      </div>

      {loading ? (
        <div className="print:hidden rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading admission letter...
        </div>
      ) : null}

      {error ? (
        <div className="print:hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {application && !isPrintableDecision(application.admissionStatus) ? (
        <div className="print:hidden rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cette demande n'est pas encore admise ou confirmee. Le bordereau
          d'admission devrait etre imprime uniquement apres une decision
          positive.
        </div>
      ) : null}

      {application ? (
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:shadow-none">
          <div className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                  Bordereau d'admission
                </div>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                  {application.school.name}
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Reference dossier : {application.applicationNumber}
                  {application.school.code ? ` - ${application.school.code}` : ""}
                </p>
              </div>

              <SchoolBadge
                tone={admissionStatusTone(application.admissionStatus) as any}
              >
                {admissionStatusLabel(application.admissionStatus)}
              </SchoolBadge>
            </div>
          </div>

          <div className="py-6">
            <p className="text-sm leading-7 text-slate-700">Madame, Monsieur,</p>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              Nous vous informons que la demande d'admission de l'eleve{" "}
              <span className="font-semibold text-slate-900">
                {application.candidate.firstName} {application.candidate.lastName}
              </span>{" "}
              a ete traitee par l'administration de l'etablissement.
            </p>

            <p className="mt-4 text-sm leading-7 text-slate-700">
              Decision administrative :{" "}
              <span className="font-semibold text-slate-900">
                {admissionStatusLabel(application.admissionStatus)}
              </span>
              .
            </p>
          </div>

          <div className="grid gap-6 border-y border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">
                Informations de l'eleve
              </h2>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Nom :</span>{" "}
                  {application.candidate.lastName}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Prenom :</span>{" "}
                  {application.candidate.firstName}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Date de naissance :
                  </span>{" "}
                  {application.candidate.dateOfBirth ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Lieu de naissance :
                  </span>{" "}
                  {application.candidate.placeOfBirth ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Ecole precedente :
                  </span>{" "}
                  {application.candidate.previousSchoolName ?? "-"}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Informations parent / tuteur
              </h2>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Nom :</span>{" "}
                  {application.parent.fullName ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Telephone :</span>{" "}
                  {application.parent.phone ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Email :</span>{" "}
                  {application.parent.email ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Classe / niveau souhaite :
                  </span>{" "}
                  {desiredClass}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-2">
            <div>
              <h2 className="font-semibold text-slate-900">
                Documents du dossier
              </h2>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>Photo : {documentStatus(application.documents.photoReceived)}</div>
                <div>
                  Acte de naissance :{" "}
                  {documentStatus(application.documents.birthCertificateReceived)}
                </div>
                <div>
                  Carnet de vaccination :{" "}
                  {documentStatus(application.documents.vaccinationCardReceived)}
                </div>
                <div>
                  Releve / dossier ecole precedente :{" "}
                  {documentStatus(application.documents.previousSchoolRecordReceived)}
                </div>
                <div>
                  Piece d'identite parent :{" "}
                  {documentStatus(application.documents.parentIdDocumentReceived)}
                </div>
                <div>
                  Certificat de bonne conduite :{" "}
                  {documentStatus(application.documents.conductCertificateReceived)}
                </div>
              </div>
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Frais d'inscription
              </h2>

              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>
                  <span className="font-medium text-slate-900">Statut :</span>{" "}
                  {feeStatusLabel(application.registrationFee.status)}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Montant :</span>{" "}
                  {application.registrationFee.required
                    ? money(
                        application.registrationFee.amount,
                        application.registrationFee.currencyCode,
                      )
                    : "Non requis"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">Recu :</span>{" "}
                  {application.registrationFee.receiptNumber ?? "-"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Examen d'admission :
                  </span>{" "}
                  {application.exam?.examStatus ?? "Non planifie"}
                </div>

                <div>
                  <span className="font-medium text-slate-900">
                    Resultat examen :
                  </span>{" "}
                  {application.exam?.totalScore != null
                    ? `${application.exam.totalScore} / ${application.exam.maxScore}`
                    : "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="py-6">
            <h2 className="font-semibold text-slate-900">Prochaines etapes</h2>

            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-700">
              <li>Finaliser les documents manquants, le cas echeant.</li>
              <li>Respecter les modalites financieres communiquees par l'ecole.</li>
              <li>Signer les engagements et reglements internes requis.</li>
              <li>Proceder a la confirmation finale de l'inscription.</li>
              <li>
                Se presenter a l'administration pour toute information
                complementaire.
              </li>
            </ol>
          </div>

          {application.notes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="font-semibold text-slate-900">Notes</h2>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {application.notes}
              </p>
            </div>
          ) : null}

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Signature parent / tuteur
              </div>
            </div>

            <div>
              <div className="border-t border-slate-400 pt-2 text-sm text-slate-600">
                Signature administration
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-xs text-slate-500">
            Document genere le {new Date().toLocaleDateString()}.
          </div>
        </div>
      ) : null}
    </div>
  );
}
