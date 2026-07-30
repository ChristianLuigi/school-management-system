"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { SchoolBadge } from "@/components/school-ui";
import { useI18n } from "@/components/i18n-provider";

type Section = "access" | "assignments" | "payroll" | "medical";

type AccessResponse = {
  linked: boolean;
  accessEnabled?: boolean;
  employmentStatus: string;
  account: {
    userId: string;
    status: string | null;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
    activeSessionCount: number;
  } | null;
  roles: string[];
  financePermissions: string[];
  pendingInvitation?: {
    id: string;
    email: string;
    roleCode: string;
    locale: string;
    expiresAt: string;
    sendCount: number;
    lastSentAt: string | null;
    deliveryFailed: boolean;
  } | null;
};

type AssignmentResponse = {
  items: Array<{
    id: string;
    academic_year_id: string;
    academic_year_name: Record<string, string>;
    section_id: string;
    section_code: string;
    section_name: Record<string, string>;
    subject_id: string;
    subject_code: string;
    subject_name: Record<string, string>;
    assignment_status: string;
  }>;
};

type AssignmentOptions = {
  userId: string | null;
  eligible: boolean;
  academicYears: Array<{
    id: string;
    nameI18n: Record<string, string>;
    status: string;
    startDate: string;
    endDate: string;
  }>;
  sections: Array<{
    id: string;
    academicYearId: string;
    code: string;
    nameI18n: Record<string, string>;
    gradeLevelCode: string;
    gradeLevelNameI18n: Record<string, string>;
    subjects: Array<{
      id: string;
      code: string;
      nameI18n: Record<string, string>;
    }>;
  }>;
};

type PayrollResponse = {
  hasProfile: boolean;
  profile: {
    id: string;
    jobTitle: string | null;
    baseSalary: number;
    currencyCode: string;
    active: boolean;
    payrollRunCount: number;
  } | null;
};

type MedicalResponse = {
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactPhone: string | null;
  allergiesOrConditions: string | null;
  accommodationNotes: string | null;
  rowVersion: number;
  updatedAt: string | null;
};

const FINANCE_PERMISSIONS = [
  "FINANCE_DASHBOARD_VIEW",
  "FINANCE_INVOICES_VIEW",
  "FINANCE_INVOICES_CREATE",
  "FINANCE_INVOICES_EDIT",
  "FINANCE_INVOICES_VOID",
  "FINANCE_BILLING_MANAGE",
  "FINANCE_PAYMENTS_VIEW",
  "FINANCE_PAYMENTS_RECORD",
  "FINANCE_PAYMENTS_REVERSE",
  "FINANCE_RECEIPTS_PRINT",
  "FINANCE_CASHIER_SESSIONS_SUPERVISE",
  "FINANCE_CREDIT_NOTES_CREATE",
  "FINANCE_CORRECTIONS_APPROVE",
  "FINANCE_RECONCILIATION_MANAGE",
  "FINANCE_PERIOD_CLOSE",
  "FINANCE_REPORTS_VIEW",
  "FINANCE_REPORTS_EXPORT",
  "FINANCE_SETTINGS_MANAGE",
  "PAYROLL_VIEW",
  "PAYROLL_PREPARE",
  "PAYROLL_REVIEW",
  "PAYROLL_PROCESS",
  "PAYROLL_REVERSE",
  "PAYROLL_MANAGE",
] as const;

const DEFAULT_FINANCE_PERMISSIONS = [
  "FINANCE_DASHBOARD_VIEW",
  "FINANCE_INVOICES_VIEW",
  "FINANCE_INVOICES_CREATE",
  "FINANCE_PAYMENTS_VIEW",
  "FINANCE_PAYMENTS_RECORD",
  "FINANCE_RECEIPTS_PRINT",
];

const COPY = {
  fr: {
    loading: "Chargement des accès opérationnels…",
    access: "Compte et accès",
    linked: "Compte lié",
    notLinked: "Aucun compte lié",
    accessEnabled: "Accès du personnel autorisé",
    accessDisabled: "Accès du personnel désactivé",
    verified: "Courriel vérifié",
    unverified: "Courriel non vérifié",
    sessions: "Sessions actives",
    roles: "Rôles scolaires",
    permissions: "Permissions financières",
    savePermissions: "Enregistrer les permissions",
    invite: "Inviter ce membre du personnel",
    inviteHelp:
      "Le compte sera lié à ce dossier uniquement après acceptation de l’invitation.",
    role: "Rôle du compte",
    email: "Courriel",
    language: "Langue du courriel",
    send: "Envoyer l’invitation",
    pending: "Invitation en attente",
    resend: "Renvoyer",
    revoke: "Révoquer",
    expires: "Expire",
    deliveryFailed: "Échec de livraison du courriel",
    assignments: "Affectations d’enseignement",
    noAssignments: "Aucune affectation académique.",
    teacherRequired:
      "Un compte actif avec le rôle Enseignant est requis avant d’attribuer des classes.",
    academicYear: "Année académique",
    saveAssignments: "Enregistrer les affectations",
    noAcademicSetup:
      "Aucune classe avec des matières configurées n’est disponible.",
    payroll: "Profil de paie",
    noPayroll: "Aucun profil de paie lié.",
    createPayroll: "Créer le profil de paie",
    baseSalary: "Salaire de base",
    currency: "Devise",
    payrollActive: "Actif pour la paie",
    notes: "Notes de paie",
    payrollRuns: "Traitements de paie",
    medical: "Informations médicales",
    medicalWarning:
      "Section confidentielle réservée aux administrateurs. N’inscrivez que les informations nécessaires en cas d’urgence ou d’aménagement.",
    emergencyName: "Personne à contacter",
    relationship: "Relation",
    emergencyPhone: "Téléphone d’urgence",
    allergies: "Allergies ou conditions importantes",
    accommodations: "Aménagements ou précautions",
    saveMedical: "Enregistrer les informations médicales",
    saved: "Modifications enregistrées.",
    invitationSent: "Invitation créée et envoyée.",
    invitationEmailFailed:
      "Invitation créée, mais le courriel n’a pas pu être livré.",
    confirmRevoke: "Révoquer cette invitation ?",
    saving: "Enregistrement…",
    active: "Actif",
    inactive: "Inactif",
  },
  en: {
    loading: "Loading operational access…",
    access: "Account and access",
    linked: "Account linked",
    notLinked: "No linked account",
    accessEnabled: "Staff access enabled",
    accessDisabled: "Staff access disabled",
    verified: "Email verified",
    unverified: "Email not verified",
    sessions: "Active sessions",
    roles: "School roles",
    permissions: "Finance permissions",
    savePermissions: "Save permissions",
    invite: "Invite this staff member",
    inviteHelp:
      "The account will be linked to this record only after the invitation is accepted.",
    role: "Account role",
    email: "Email",
    language: "Email language",
    send: "Send invitation",
    pending: "Pending invitation",
    resend: "Resend",
    revoke: "Revoke",
    expires: "Expires",
    deliveryFailed: "Email delivery failed",
    assignments: "Teaching assignments",
    noAssignments: "No academic assignments.",
    teacherRequired:
      "An active account with the Teacher role is required before assigning classes.",
    academicYear: "Academic year",
    saveAssignments: "Save assignments",
    noAcademicSetup:
      "No sections with configured subjects are available.",
    payroll: "Payroll profile",
    noPayroll: "No payroll profile is linked.",
    createPayroll: "Create payroll profile",
    baseSalary: "Base salary",
    currency: "Currency",
    payrollActive: "Active for payroll",
    notes: "Payroll notes",
    payrollRuns: "Payroll runs",
    medical: "Medical information",
    medicalWarning:
      "Confidential administrator-only section. Record only information needed for emergencies or workplace accommodations.",
    emergencyName: "Emergency contact",
    relationship: "Relationship",
    emergencyPhone: "Emergency phone",
    allergies: "Important allergies or conditions",
    accommodations: "Accommodations or precautions",
    saveMedical: "Save medical information",
    saved: "Changes saved.",
    invitationSent: "Invitation created and sent.",
    invitationEmailFailed:
      "Invitation created, but the email could not be delivered.",
    confirmRevoke: "Revoke this invitation?",
    saving: "Saving…",
    active: "Active",
    inactive: "Inactive",
  },
} as const;

function label(
  value: Record<string, string> | null | undefined,
  locale: "fr" | "en",
) {
  return value?.[locale] ?? value?.fr ?? value?.en ?? "—";
}

async function responseBody(response: Response) {
  return response.json().catch(() => null);
}

export function StaffOperationalWorkspaceClient({
  schoolId,
  staffId,
  firstName,
  lastName,
  email,
  section,
}: {
  schoolId: string;
  staffId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  section: Section;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [assignments, setAssignments] = useState<AssignmentResponse>({
    items: [],
  });
  const [assignmentOptions, setAssignmentOptions] =
    useState<AssignmentOptions>({
      userId: null,
      eligible: false,
      academicYears: [],
      sections: [],
    });
  const [payroll, setPayroll] = useState<PayrollResponse>({
    hasProfile: false,
    profile: null,
  });
  const [medical, setMedical] = useState<MedicalResponse>({
    emergencyContactName: null,
    emergencyContactRelationship: null,
    emergencyContactPhone: null,
    allergiesOrConditions: null,
    accommodationNotes: null,
    rowVersion: 0,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [inviteEmail, setInviteEmail] = useState(email ?? "");
  const [inviteRole, setInviteRole] = useState<"TEACHER" | "FINANCE_ADMIN">(
    "TEACHER",
  );
  const [inviteLocale, setInviteLocale] = useState<"fr" | "en">(locale);
  const [financePermissions, setFinancePermissions] = useState<string[]>([]);
  const [inviteFinancePermissions, setInviteFinancePermissions] = useState<
    string[]
  >(DEFAULT_FINANCE_PERMISSIONS);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
  const [baseSalary, setBaseSalary] = useState("");
  const [currencyCode, setCurrencyCode] = useState("HTG");
  const [payrollActive, setPayrollActive] = useState(true);
  const [payrollNotes, setPayrollNotes] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [allergies, setAllergies] = useState("");
  const [accommodations, setAccommodations] = useState("");

  const selectYear = useCallback(
    (yearId: string, items: AssignmentResponse["items"]) => {
      setSelectedYear(yearId);
      setSelectedAssignments(
        items
          .filter((item) => item.academic_year_id === yearId)
          .map((item) => `${item.section_id}:${item.subject_id}`),
      );
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ schoolId }).toString();
      const base = `/api/staff-management/staff/${encodeURIComponent(staffId)}`;
      const responses = await Promise.all([
        fetch(`${base}/access?${query}`, { cache: "no-store" }),
        fetch(`${base}/assignments?${query}`, { cache: "no-store" }),
        fetch(`${base}/assignment-options?${query}`, { cache: "no-store" }),
        fetch(`${base}/payroll-summary?${query}`, { cache: "no-store" }),
        fetch(`${base}/medical?${query}`, { cache: "no-store" }),
      ]);
      const bodies = await Promise.all(responses.map(responseBody));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) {
        throw new Error(
          bodies[failed]?.message ?? "Unable to load operational access.",
        );
      }
      const nextAccess = bodies[0] as AccessResponse;
      const nextAssignments = bodies[1] as AssignmentResponse;
      const nextOptions = bodies[2] as AssignmentOptions;
      const nextPayroll = bodies[3] as PayrollResponse;
      const nextMedical = bodies[4] as MedicalResponse;
      setAccess(nextAccess);
      setAssignments(nextAssignments);
      setAssignmentOptions(nextOptions);
      setPayroll(nextPayroll);
      setMedical(nextMedical);
      setFinancePermissions(nextAccess.financePermissions);
      setEmergencyName(nextMedical.emergencyContactName ?? "");
      setEmergencyRelationship(
        nextMedical.emergencyContactRelationship ?? "",
      );
      setEmergencyPhone(nextMedical.emergencyContactPhone ?? "");
      setAllergies(nextMedical.allergiesOrConditions ?? "");
      setAccommodations(nextMedical.accommodationNotes ?? "");
      const nextYear =
        selectedYear &&
        nextOptions.academicYears.some((year) => year.id === selectedYear)
          ? selectedYear
          : (nextOptions.academicYears.find((year) => year.status === "ACTIVE")
              ?.id ?? nextOptions.academicYears[0]?.id ?? "");
      selectYear(nextYear, nextAssignments.items);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load operational access.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedYear, selectYear, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/auth/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          staffAccountId: staffId,
          email: inviteEmail,
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          roleCode: inviteRole,
          locale: inviteLocale,
          financePermissionCodes:
            inviteRole === "FINANCE_ADMIN"
              ? inviteFinancePermissions
              : undefined,
        }),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to create invitation.");
      }
      setMessage(
        body.emailSent ? copy.invitationSent : copy.invitationEmailFailed,
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create invitation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function invitationAction(kind: "resend" | "revoke") {
    const invitation = access?.pendingInvitation;
    if (!invitation) return;
    if (kind === "revoke" && !window.confirm(copy.confirmRevoke)) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        kind === "resend"
          ? "/api/auth/invitations/resend"
          : `/api/auth/invitations/${encodeURIComponent(invitation.id)}`,
        {
          method: kind === "resend" ? "POST" : "DELETE",
          headers:
            kind === "resend"
              ? { "Content-Type": "application/json" }
              : undefined,
          body:
            kind === "resend"
              ? JSON.stringify({ invitationId: invitation.id })
              : undefined,
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update invitation.");
      }
      setMessage(copy.saved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update invitation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveFinancePermissions() {
    if (!access?.account) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/access-management/finance/${encodeURIComponent(access.account.userId)}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, permissionCodes: financePermissions }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update permissions.");
      }
      setMessage(copy.saved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update permissions.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignments() {
    if (!assignmentOptions.userId || !selectedYear) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/access-management/teachers/${encodeURIComponent(assignmentOptions.userId)}/assignments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            academicYearId: selectedYear,
            assignments: selectedAssignments.map((value) => {
              const [sectionId, subjectId] = value.split(":");
              return { sectionId, subjectId };
            }),
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update assignments.");
      }
      setMessage(copy.saved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update assignments.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createPayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/finance/payroll/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          staffAccountId: staffId,
          baseSalary: Number(baseSalary),
          currencyCode,
          payrollActive,
          notes: payrollNotes.trim() || undefined,
        }),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to create payroll profile.");
      }
      setMessage(copy.saved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create payroll profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMedical(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(staffId)}/medical`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            rowVersion: medical.rowVersion,
            emergencyContactName: emergencyName,
            emergencyContactRelationship: emergencyRelationship,
            emergencyContactPhone: emergencyPhone,
            allergiesOrConditions: allergies,
            accommodationNotes: accommodations,
          }),
        },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(
          body?.message ?? "Unable to update medical information.",
        );
      }
      setMessage(copy.saved);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update medical information.",
      );
    } finally {
      setSaving(false);
    }
  }

  const yearSections = useMemo(
    () =>
      assignmentOptions.sections.filter(
        (item) => item.academicYearId === selectedYear,
      ),
    [assignmentOptions.sections, selectedYear],
  );

  const toggle = (
    value: string,
    values: string[],
    setter: (values: string[]) => void,
  ) => {
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  if (loading && !access) {
    return <div className="text-sm text-slate-500">{copy.loading}</div>;
  }

  return (
    <div className="space-y-5">
      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {section === "access" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title={copy.access}>
            <div className="space-y-3 text-sm">
              <Row
                label={copy.access}
                value={access?.linked ? copy.linked : copy.notLinked}
              />
              {access?.linked ? (
                <>
                  <Row
                    label={copy.access}
                    value={
                      access.accessEnabled
                        ? copy.accessEnabled
                        : copy.accessDisabled
                    }
                  />
                  <Row
                    label={copy.email}
                    value={
                      access.account?.emailVerifiedAt
                        ? copy.verified
                        : copy.unverified
                    }
                  />
                  <Row
                    label={copy.sessions}
                    value={String(access.account?.activeSessionCount ?? 0)}
                  />
                  <div className="pt-2">
                    <div className="mb-2 font-medium">{copy.roles}</div>
                    <div className="flex flex-wrap gap-2">
                      {access.roles.map((role) => (
                        <SchoolBadge key={role} tone="blue">
                          {role.replaceAll("_", " ")}
                        </SchoolBadge>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </Panel>

          {!access?.linked ? (
            <Panel
              title={
                access?.pendingInvitation ? copy.pending : copy.invite
              }
            >
              {access?.pendingInvitation ? (
                <div className="space-y-4 text-sm">
                  <Row
                    label={copy.email}
                    value={access.pendingInvitation.email}
                  />
                  <Row
                    label={copy.role}
                    value={access.pendingInvitation.roleCode.replaceAll(
                      "_",
                      " ",
                    )}
                  />
                  <Row
                    label={copy.expires}
                    value={new Intl.DateTimeFormat(
                      locale === "fr" ? "fr-HT" : "en-US",
                      { dateStyle: "medium", timeStyle: "short" },
                    ).format(new Date(access.pendingInvitation.expiresAt))}
                  />
                  {access.pendingInvitation.deliveryFailed ? (
                    <div className="text-red-700">{copy.deliveryFailed}</div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void invitationAction("resend")}
                      className="rounded-xl border border-slate-300 px-4 py-2 font-medium"
                    >
                      {copy.resend}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void invitationAction("revoke")}
                      className="rounded-xl border border-red-200 px-4 py-2 font-medium text-red-700"
                    >
                      {copy.revoke}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={sendInvitation} className="space-y-4">
                  <p className="text-sm text-slate-600">{copy.inviteHelp}</p>
                  <Field label={copy.email}>
                    <input
                      required
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      className="staff-input"
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={copy.role}>
                      <select
                        value={inviteRole}
                        onChange={(event) =>
                          setInviteRole(
                            event.target.value as
                              | "TEACHER"
                              | "FINANCE_ADMIN",
                          )
                        }
                        className="staff-input"
                      >
                        <option value="TEACHER">TEACHER</option>
                        <option value="FINANCE_ADMIN">FINANCE ADMIN</option>
                      </select>
                    </Field>
                    <Field label={copy.language}>
                      <select
                        value={inviteLocale}
                        onChange={(event) =>
                          setInviteLocale(event.target.value as "fr" | "en")
                        }
                        className="staff-input"
                      >
                        <option value="fr">Français</option>
                        <option value="en">English</option>
                      </select>
                    </Field>
                  </div>
                  {inviteRole === "FINANCE_ADMIN" ? (
                    <PermissionGrid
                      values={inviteFinancePermissions}
                      onToggle={(permission) =>
                        toggle(
                          permission,
                          inviteFinancePermissions,
                          setInviteFinancePermissions,
                        )
                      }
                    />
                  ) : null}
                  <button
                    disabled={saving}
                    className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {saving ? copy.saving : copy.send}
                  </button>
                </form>
              )}
            </Panel>
          ) : access.roles.includes("FINANCE_ADMIN") ? (
            <Panel title={copy.permissions}>
              <PermissionGrid
                values={financePermissions}
                onToggle={(permission) =>
                  toggle(
                    permission,
                    financePermissions,
                    setFinancePermissions,
                  )
                }
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveFinancePermissions()}
                className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? copy.saving : copy.savePermissions}
              </button>
            </Panel>
          ) : (
            <Panel title={copy.permissions}>
              <div className="text-sm text-slate-500">—</div>
            </Panel>
          )}
        </div>
      ) : null}

      {section === "assignments" ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Panel title={copy.assignments}>
            <div className="divide-y divide-slate-100">
              {assignments.items.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">
                      {label(assignment.subject_name, locale)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {label(assignment.section_name, locale)} ·{" "}
                      {label(assignment.academic_year_name, locale)}
                    </div>
                  </div>
                  <SchoolBadge
                    tone={
                      assignment.assignment_status === "ACTIVE"
                        ? "green"
                        : "neutral"
                    }
                  >
                    {assignment.assignment_status}
                  </SchoolBadge>
                </div>
              ))}
              {!assignments.items.length ? (
                <div className="py-6 text-sm text-slate-500">
                  {copy.noAssignments}
                </div>
              ) : null}
            </div>
          </Panel>
          <Panel title={copy.saveAssignments}>
            {!assignmentOptions.eligible ? (
              <div className="text-sm text-amber-700">
                {copy.teacherRequired}
              </div>
            ) : (
              <div className="space-y-4">
                <Field label={copy.academicYear}>
                  <select
                    value={selectedYear}
                    onChange={(event) =>
                      selectYear(event.target.value, assignments.items)
                    }
                    className="staff-input"
                  >
                    {assignmentOptions.academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {label(year.nameI18n, locale)} · {year.status}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="max-h-[30rem] space-y-4 overflow-y-auto pr-2">
                  {yearSections.map((sectionOption) => (
                    <fieldset
                      key={sectionOption.id}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <legend className="px-2 text-sm font-semibold">
                        {label(sectionOption.gradeLevelNameI18n, locale)} ·{" "}
                        {label(sectionOption.nameI18n, locale)}
                      </legend>
                      <div className="space-y-2">
                        {sectionOption.subjects.map((subject) => {
                          const value = `${sectionOption.id}:${subject.id}`;
                          return (
                            <label
                              key={value}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAssignments.includes(value)}
                                onChange={() =>
                                  toggle(
                                    value,
                                    selectedAssignments,
                                    setSelectedAssignments,
                                  )
                                }
                              />
                              {label(subject.nameI18n, locale)}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                  {!yearSections.length ? (
                    <div className="text-sm text-slate-500">
                      {copy.noAcademicSetup}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={saving || !selectedYear}
                  onClick={() => void saveAssignments()}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? copy.saving : copy.saveAssignments}
                </button>
              </div>
            )}
          </Panel>
        </div>
      ) : null}

      {section === "payroll" ? (
        <Panel title={copy.payroll}>
          {payroll.profile ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Metric
                label={copy.baseSalary}
                value={new Intl.NumberFormat(
                  locale === "fr" ? "fr-HT" : "en-US",
                  {
                    style: "currency",
                    currency: payroll.profile.currencyCode,
                  },
                ).format(payroll.profile.baseSalary)}
              />
              <Metric
                label={copy.payrollRuns}
                value={String(payroll.profile.payrollRunCount)}
              />
              <Metric
                label={copy.payroll}
                value={payroll.profile.active ? copy.active : copy.inactive}
              />
            </div>
          ) : access?.linked ? (
            <form
              onSubmit={createPayroll}
              className="grid gap-4 md:grid-cols-2"
            >
              <Field label={copy.baseSalary}>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseSalary}
                  onChange={(event) => setBaseSalary(event.target.value)}
                  className="staff-input"
                />
              </Field>
              <Field label={copy.currency}>
                <select
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                  className="staff-input"
                >
                  <option value="HTG">HTG</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label={copy.notes}>
                  <textarea
                    rows={3}
                    value={payrollNotes}
                    onChange={(event) => setPayrollNotes(event.target.value)}
                    className="staff-input"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={payrollActive}
                  onChange={(event) => setPayrollActive(event.target.checked)}
                />
                {copy.payrollActive}
              </label>
              <div className="md:col-span-2">
                <button
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? copy.saving : copy.createPayroll}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-sm text-amber-700">
              {copy.notLinked} · {copy.noPayroll}
            </div>
          )}
        </Panel>
      ) : null}

      {section === "medical" ? (
        <Panel title={copy.medical}>
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {copy.medicalWarning}
          </div>
          <form
            onSubmit={saveMedical}
            className="grid gap-4 md:grid-cols-2"
          >
            <Field label={copy.emergencyName}>
              <input
                value={emergencyName}
                onChange={(event) => setEmergencyName(event.target.value)}
                className="staff-input"
              />
            </Field>
            <Field label={copy.relationship}>
              <input
                value={emergencyRelationship}
                onChange={(event) =>
                  setEmergencyRelationship(event.target.value)
                }
                className="staff-input"
              />
            </Field>
            <Field label={copy.emergencyPhone}>
              <input
                value={emergencyPhone}
                onChange={(event) => setEmergencyPhone(event.target.value)}
                className="staff-input"
              />
            </Field>
            <div />
            <Field label={copy.allergies}>
              <textarea
                rows={4}
                maxLength={1000}
                value={allergies}
                onChange={(event) => setAllergies(event.target.value)}
                className="staff-input"
              />
            </Field>
            <Field label={copy.accommodations}>
              <textarea
                rows={4}
                maxLength={1000}
                value={accommodations}
                onChange={(event) => setAccommodations(event.target.value)}
                className="staff-input"
              />
            </Field>
            <div className="md:col-span-2">
              <button
                disabled={saving}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? copy.saving : copy.saveMedical}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

function PermissionGrid({
  values,
  onToggle,
}: {
  values: string[];
  onToggle: (permission: string) => void;
}) {
  return (
    <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
      {FINANCE_PERMISSIONS.map((permission) => (
        <label key={permission} className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={values.includes(permission)}
            onChange={() => onToggle(permission)}
          />
          <span>{permission.replaceAll("_", " ")}</span>
        </label>
      ))}
    </div>
  );
}

function Field({
  label: fieldLabel,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">{fieldLabel}</span>
      {children}
    </label>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label: rowLabel, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
      <span className="text-slate-500">{rowLabel}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function Metric({
  label: metricLabel,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {metricLabel}
      </div>
      <div className="mt-2 font-semibold text-slate-950">{value}</div>
    </div>
  );
}
