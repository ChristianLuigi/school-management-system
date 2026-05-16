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
    <div className="admission-letter-print-page space-y-6">
      <div className="admission-letter-no-print flex flex-wrap items-center justify-between gap-3">
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
        <div className="admission-letter-no-print rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Loading admission letter...
        </div>
      ) : null}

      {error ? (
        <div className="admission-letter-no-print rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {application && !isPrintableDecision(application.admissionStatus) ? (
        <div className="admission-letter-no-print rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Cette demande n'est pas encore admise ou confirmee. Le bordereau
          d'admission devrait etre imprime uniquement apres une decision
          positive.
        </div>
      ) : null}

      {application ? (
        <div className="admission-letter-sheet rounded-2xl border border-slate-200 shadow-sm">
          <div className="admission-letter-section border-b border-slate-200 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="admission-letter-subtitle uppercase text-slate-500">
                  Bordereau d'admission
                </div>

                <h1 className="admission-letter-title mt-1 font-bold text-slate-900">
                  {application.school.name}
                </h1>

                <div className="mt-1 text-[10px] text-slate-500">
                  Dossier : {application.applicationNumber}
                  {application.school.code ? ` - ${application.school.code}` : ""}
                </div>
              </div>

              <SchoolBadge
                tone={admissionStatusTone(application.admissionStatus) as any}
              >
                {admissionStatusLabel(application.admissionStatus)}
              </SchoolBadge>
            </div>
          </div>

          <div className="admission-letter-section py-3 text-[11px] leading-5 text-slate-700">
            La presente atteste que la demande d'admission de{" "}
            <span className="font-bold text-slate-900">
              {application.candidate.firstName} {application.candidate.lastName}
            </span>{" "}
            a ete etudiee par l'administration. Decision :{" "}
            <span className="font-bold text-slate-900">
              {admissionStatusLabel(application.admissionStatus)}
            </span>
            .
          </div>

          <div className="admission-letter-grid admission-letter-section">
            <div className="admission-letter-box">
              <div className="admission-letter-box-title">Eleve</div>

              <div className="admission-letter-line">
                <span>Nom</span>
                <span>{application.candidate.lastName}</span>
              </div>

              <div className="admission-letter-line">
                <span>Prenom</span>
                <span>{application.candidate.firstName}</span>
              </div>

              <div className="admission-letter-line">
                <span>Date naissance</span>
                <span>{application.candidate.dateOfBirth ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Lieu naissance</span>
                <span>{application.candidate.placeOfBirth ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Ecole precedente</span>
                <span>{application.candidate.previousSchoolName ?? "-"}</span>
              </div>
            </div>

            <div className="admission-letter-box">
              <div className="admission-letter-box-title">Parent / Tuteur</div>

              <div className="admission-letter-line">
                <span>Nom</span>
                <span>{application.parent.fullName ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Telephone</span>
                <span>{application.parent.phone ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Email</span>
                <span>{application.parent.email ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Classe souhaitee</span>
                <span>{desiredClass}</span>
              </div>

              <div className="admission-letter-line">
                <span>Date dossier</span>
                <span>{new Date(application.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="admission-letter-box">
              <div className="admission-letter-box-title">Documents</div>

              <div className="admission-letter-line">
                <span>Photo</span>
                <span>{documentStatus(application.documents.photoReceived)}</span>
              </div>

              <div className="admission-letter-line">
                <span>Acte naissance</span>
                <span>{documentStatus(application.documents.birthCertificateReceived)}</span>
              </div>

              <div className="admission-letter-line">
                <span>Carnet vaccination</span>
                <span>{documentStatus(application.documents.vaccinationCardReceived)}</span>
              </div>

              <div className="admission-letter-line">
                <span>Dossier ancienne ecole</span>
                <span>{documentStatus(application.documents.previousSchoolRecordReceived)}</span>
              </div>

              <div className="admission-letter-line">
                <span>Piece identite parent</span>
                <span>{documentStatus(application.documents.parentIdDocumentReceived)}</span>
              </div>
            </div>

            <div className="admission-letter-box">
              <div className="admission-letter-box-title">Frais / Examen</div>

              <div className="admission-letter-line">
                <span>Frais inscription</span>
                <span>{feeStatusLabel(application.registrationFee.status)}</span>
              </div>

              <div className="admission-letter-line">
                <span>Montant</span>
                <span>
                  {application.registrationFee.required
                    ? money(
                        application.registrationFee.amount,
                        application.registrationFee.currencyCode,
                      )
                    : "Non requis"}
                </span>
              </div>

              <div className="admission-letter-line">
                <span>Recu</span>
                <span>{application.registrationFee.receiptNumber ?? "-"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Examen</span>
                <span>{application.exam?.examStatus ?? "Non planifie"}</span>
              </div>

              <div className="admission-letter-line">
                <span>Resultat</span>
                <span>
                  {application.exam?.totalScore != null
                    ? `${application.exam.totalScore} / ${application.exam.maxScore}`
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="admission-letter-section mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[12px] font-bold text-slate-900">
              Prochaines etapes
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[10.5px] leading-4 text-slate-700">
              <div>1. Finaliser les documents manquants.</div>
              <div>2. Respecter les modalites financieres.</div>
              <div>3. Signer les engagements requis.</div>
              <div>4. Confirmer l'inscription aupres de l'administration.</div>
            </div>
          </div>

          {application.notes ? (
            <div className="admission-letter-section mt-3 rounded-xl border border-slate-200 p-3">
              <div className="text-[12px] font-bold text-slate-900">Notes</div>
              <p className="mt-1 line-clamp-3 text-[10.5px] leading-4 text-slate-700">
                {application.notes}
              </p>
            </div>
          ) : null}

          <div className="admission-letter-signatures admission-letter-section">
            <div className="admission-letter-signature-line">
              Signature parent / tuteur
            </div>

            <div className="admission-letter-signature-line">
              Signature administration
            </div>
          </div>

          <div className="mt-4 text-center text-[9px] text-slate-500">
            Document genere le {new Date().toLocaleDateString()}.
          </div>
        </div>
      ) : null}
    </div>
  );
}
