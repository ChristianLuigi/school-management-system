"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { SchoolBadge } from "@/components/school-ui";
import { StaffComplianceWorkspaceClient } from "@/components/staff-compliance-workspace-client";
import { StaffOperationalWorkspaceClient } from "@/components/staff-operational-workspace-client";
import {
  categoryLabel,
  employmentTypeLabel,
  staffName,
  statusLabel,
  statusTone,
} from "@/lib/staff/presentation";
import type {
  EmploymentStatus,
  EmploymentType,
  StaffCategory,
  StaffOptions,
  StaffRecord,
} from "@/lib/staff/types";

type StaffDetails = StaffRecord & {
  supervisor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  account: {
    linked: true;
    status: string | null;
    emailVerifiedAt: string | null;
    lastLoginAt: string | null;
  } | null;
};

type HistoryResponse = {
  statusEvents: Array<{
    id: string;
    previousStatus: EmploymentStatus | null;
    newStatus: EmploymentStatus;
    effectiveDate: string;
    reason: string;
    actorUserId: string | null;
    createdAt: string;
  }>;
  employmentPeriods: Array<{
    id: string;
    start_date: string;
    end_date: string | null;
    employment_type: EmploymentType;
    position_title: string | null;
    department: string | null;
    work_location: string | null;
    reason: string;
  }>;
  positions: Array<{
    id: string;
    position_title: string | null;
    department: string | null;
    supervisor_first_name: string | null;
    supervisor_last_name: string | null;
    work_location: string | null;
    start_date: string;
    end_date: string | null;
    change_reason: string;
  }>;
};

type Tab =
  | "overview"
  | "history"
  | "access"
  | "assignments"
  | "payroll"
  | "documents"
  | "leaveRequests"
  | "medical";
type LifecycleAction =
  | "activate"
  | "leave"
  | "suspend"
  | "reactivate"
  | "terminate"
  | "rehire"
  | "archive";

const COPY = {
  fr: {
    back: "Retour au personnel",
    loading: "Chargement du dossier…",
    overview: "Dossier",
    history: "Historique",
    access: "Accès",
    assignments: "Affectations",
    payroll: "Paie",
    documents: "Documents",
    leaveRequests: "Congés",
    medical: "Informations médicales",
    address: "Adresse",
    addressLine1: "Adresse principale",
    addressLine2: "Complément d’adresse",
    addressCity: "Ville / Commune",
    addressRegion: "Département / Région",
    addressPostalCode: "Code postal",
    addressCountryCode: "Pays (code à 2 lettres)",
    edit: "Modifier le dossier",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Le dossier a été mis à jour.",
    identity: "Identité et coordonnées",
    employment: "Emploi et poste",
    firstName: "Prénom",
    lastName: "Nom",
    preferredName: "Nom préféré",
    email: "Courriel",
    phone: "Téléphone",
    staffCode: "Code du personnel",
    category: "Catégorie",
    employmentType: "Type d’emploi",
    hireDate: "Date d’embauche",
    jobTitle: "Titre du poste",
    department: "Département",
    workLocation: "Lieu de travail",
    supervisor: "Superviseur",
    noSupervisor: "Aucun superviseur",
    effectiveDate: "Date d’effet",
    changeReason: "Motif de la modification",
    positionReasonRequired:
      "Un motif est obligatoire lorsque le poste ou le superviseur change.",
    lifecycle: "Cycle d’emploi",
    lifecycleDescription:
      "Toute modification révoque les sessions actives. Les accès de paie et d’enseignement ne sont jamais rétablis automatiquement.",
    reason: "Motif obligatoire",
    cancel: "Annuler",
    confirm: "Confirmer",
    noActions: "Aucune action disponible pour ce statut.",
    accountLinked: "Compte utilisateur lié",
    accountMissing: "Aucun compte utilisateur lié",
    accessEnabled: "Accès du personnel autorisé",
    accessDisabled: "Accès du personnel désactivé",
    verified: "Courriel vérifié",
    unverified: "Courriel non vérifié",
    activeSessions: "Sessions actives",
    roles: "Rôles scolaires",
    permissions: "Permissions financières",
    noPermissions: "Aucune permission financière.",
    noAssignments: "Aucune affectation académique.",
    noPayroll: "Aucun profil de paie lié.",
    salary: "Salaire de base",
    payrollRuns: "Traitements de paie",
    active: "Actif",
    inactive: "Inactif",
    statusHistory: "Historique des statuts",
    employmentPeriods: "Périodes d’emploi",
    positions: "Historique des postes",
    noHistory: "Aucun historique.",
    through: "au",
    present: "aujourd’hui",
    activate: "Activer",
    leave: "Mettre en congé",
    suspend: "Suspendre",
    reactivate: "Réactiver",
    terminate: "Terminer l’emploi",
    rehire: "Réembaucher",
    archive: "Archiver",
    destructiveConfirm:
      "Confirmer cette action ? Les sessions actives seront révoquées.",
  },
  en: {
    back: "Back to staff",
    loading: "Loading staff record…",
    overview: "Record",
    history: "History",
    access: "Access",
    assignments: "Assignments",
    payroll: "Payroll",
    documents: "Documents",
    leaveRequests: "Leave",
    medical: "Medical",
    address: "Address",
    addressLine1: "Address line 1",
    addressLine2: "Address line 2",
    addressCity: "City / Commune",
    addressRegion: "State / Department / Region",
    addressPostalCode: "Postal code",
    addressCountryCode: "Country (2-letter code)",
    edit: "Edit record",
    save: "Save changes",
    saving: "Saving…",
    saved: "The staff record was updated.",
    identity: "Identity and contact",
    employment: "Employment and position",
    firstName: "First name",
    lastName: "Last name",
    preferredName: "Preferred name",
    email: "Email",
    phone: "Phone",
    staffCode: "Staff code",
    category: "Category",
    employmentType: "Employment type",
    hireDate: "Hire date",
    jobTitle: "Job title",
    department: "Department",
    workLocation: "Work location",
    supervisor: "Supervisor",
    noSupervisor: "No supervisor",
    effectiveDate: "Effective date",
    changeReason: "Change reason",
    positionReasonRequired:
      "A reason is required when the position or supervisor changes.",
    lifecycle: "Employment lifecycle",
    lifecycleDescription:
      "Every change revokes active sessions. Payroll and teaching access are never restored automatically.",
    reason: "Required reason",
    cancel: "Cancel",
    confirm: "Confirm",
    noActions: "No action is available for this status.",
    accountLinked: "User account linked",
    accountMissing: "No user account linked",
    accessEnabled: "Staff access enabled",
    accessDisabled: "Staff access disabled",
    verified: "Email verified",
    unverified: "Email not verified",
    activeSessions: "Active sessions",
    roles: "School roles",
    permissions: "Finance permissions",
    noPermissions: "No finance permissions.",
    noAssignments: "No academic assignments.",
    noPayroll: "No payroll profile is linked.",
    salary: "Base salary",
    payrollRuns: "Payroll runs",
    active: "Active",
    inactive: "Inactive",
    statusHistory: "Status history",
    employmentPeriods: "Employment periods",
    positions: "Position history",
    noHistory: "No history available.",
    through: "through",
    present: "present",
    activate: "Activate",
    leave: "Place on leave",
    suspend: "Suspend",
    reactivate: "Reactivate",
    terminate: "Terminate employment",
    rehire: "Rehire",
    archive: "Archive",
    destructiveConfirm:
      "Confirm this action? Active sessions will be revoked.",
  },
} as const;

const EMPTY_OPTIONS: StaffOptions = {
  staffCategories: [],
  employmentTypes: [],
  employmentStatuses: [],
  departments: [],
  supervisors: [],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function json(response: Response) {
  return response.json().catch(() => null);
}

function lifecycleActions(status: EmploymentStatus): LifecycleAction[] {
  if (status === "DRAFT") return ["activate", "archive"];
  if (status === "ACTIVE") return ["leave", "suspend", "terminate"];
  if (status === "ON_LEAVE") return ["reactivate", "suspend", "terminate"];
  if (status === "SUSPENDED") return ["reactivate", "terminate"];
  if (status === "TERMINATED") return ["rehire", "archive"];
  return [];
}

export function StaffDetailClient({
  schoolId,
  staffId,
}: {
  schoolId: string;
  staffId: string;
}) {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [staff, setStaff] = useState<StaffDetails | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [options, setOptions] = useState<StaffOptions>(EMPTY_OPTIONS);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] =
    useState<LifecycleAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [actionDate, setActionDate] = useState(today());

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressRegion, setAddressRegion] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountryCode, setAddressCountryCode] = useState("HT");
  const [staffCode, setStaffCode] = useState("");
  const [staffCategory, setStaffCategory] =
    useState<StaffCategory>("OTHER");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME");
  const [hireDate, setHireDate] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [changeReason, setChangeReason] = useState("");

  const syncForm = useCallback((value: StaffDetails) => {
    setFirstName(value.firstName ?? "");
    setLastName(value.lastName ?? "");
    setPreferredName(value.preferredName ?? "");
    setEmail(value.email ?? "");
    setPhone(value.phone ?? "");
    setAddressLine1(value.addressLine1 ?? "");
    setAddressLine2(value.addressLine2 ?? "");
    setAddressCity(value.addressCity ?? "");
    setAddressRegion(value.addressRegion ?? "");
    setAddressPostalCode(value.addressPostalCode ?? "");
    setAddressCountryCode(value.addressCountryCode ?? "HT");
    setStaffCode(value.staffCode ?? "");
    setStaffCategory(value.staffCategory);
    setEmploymentType(value.employmentType);
    setHireDate(value.hireDate ?? "");
    setJobTitle(value.jobTitle ?? "");
    setDepartment(value.department ?? "");
    setWorkLocation(value.workLocation ?? "");
    setSupervisorId(value.supervisorStaffAccountId ?? "");
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ schoolId }).toString();
      const base = `/api/staff-management/staff/${encodeURIComponent(staffId)}`;
      const responses = await Promise.all([
        fetch(`${base}?${query}`, { cache: "no-store" }),
        fetch(`${base}/history?${query}`, { cache: "no-store" }),
        fetch(`/api/staff-management/options?${query}`, { cache: "no-store" }),
      ]);
      const bodies = await Promise.all(responses.map(json));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) {
        throw new Error(bodies[failed]?.message ?? "Unable to load staff.");
      }
      const details = bodies[0] as StaffDetails;
      setStaff(details);
      syncForm(details);
      setHistory(bodies[1] as HistoryResponse);
      setOptions(bodies[2] as StaffOptions);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load staff.",
      );
    } finally {
      setLoading(false);
    }
  }, [schoolId, staffId, syncForm]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const availableActions = useMemo(
    () => (staff ? lifecycleActions(staff.employmentStatus) : []),
    [staff],
  );

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staff) return;
    const payload: Record<string, unknown> = {
      schoolId,
      rowVersion: staff.rowVersion,
    };
    const addIfChanged = (
      key: string,
      current: string | null,
      next: string,
    ) => {
      if ((current ?? "") !== next) payload[key] = next;
    };
    addIfChanged("firstName", staff.firstName, firstName);
    addIfChanged("lastName", staff.lastName, lastName);
    addIfChanged("preferredName", staff.preferredName, preferredName);
    addIfChanged("email", staff.email, email);
    addIfChanged("phone", staff.phone, phone);
    addIfChanged("addressLine1", staff.addressLine1, addressLine1);
    addIfChanged("addressLine2", staff.addressLine2, addressLine2);
    addIfChanged("addressCity", staff.addressCity, addressCity);
    addIfChanged("addressRegion", staff.addressRegion, addressRegion);
    addIfChanged(
      "addressPostalCode",
      staff.addressPostalCode,
      addressPostalCode,
    );
    addIfChanged(
      "addressCountryCode",
      staff.addressCountryCode,
      addressCountryCode.toUpperCase(),
    );
    addIfChanged("staffCode", staff.staffCode, staffCode);
    if (staff.staffCategory !== staffCategory)
      payload.staffCategory = staffCategory;
    if (staff.employmentType !== employmentType)
      payload.employmentType = employmentType;
    if ((staff.hireDate ?? "") !== hireDate) payload.hireDate = hireDate;

    const positionChanged =
      (staff.jobTitle ?? "") !== jobTitle ||
      (staff.department ?? "") !== department ||
      (staff.workLocation ?? "") !== workLocation ||
      (staff.supervisorStaffAccountId ?? "") !== supervisorId;
    if (positionChanged && !changeReason.trim()) {
      setError(copy.positionReasonRequired);
      setMessage("");
      return;
    }
    if (positionChanged) {
      payload.jobTitle = jobTitle;
      payload.department = department;
      payload.workLocation = workLocation;
      payload.supervisorStaffAccountId = supervisorId || null;
      payload.effectiveDate = effectiveDate;
      payload.changeReason = changeReason.trim();
    }
    if (Object.keys(payload).length === 2) {
      setMessage(copy.saved);
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(staffId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await json(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update staff record.");
      }
      setChangeReason("");
      setMessage(copy.saved);
      await loadAll();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update staff record.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyLifecycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!staff || !selectedAction) return;
    if (
      ["suspend", "terminate", "archive"].includes(selectedAction) &&
      !window.confirm(copy.destructiveConfirm)
    ) {
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `/api/staff-management/staff/${encodeURIComponent(staffId)}/${selectedAction}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            rowVersion: staff.rowVersion,
            effectiveDate: actionDate,
            reason: actionReason,
          }),
        },
      );
      const body = await json(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to update staff status.");
      }
      setSelectedAction(null);
      setActionReason("");
      await loadAll();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update staff status.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && !staff) {
    return <div className="p-8 text-sm text-slate-500">{copy.loading}</div>;
  }
  if (!staff) {
    return (
      <div className="space-y-4">
        <Link href="/staff" className="text-sm font-medium text-blue-700">
          ← {copy.back}
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Staff record not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/staff"
        className="inline-flex text-sm font-medium text-blue-700 hover:underline"
      >
        ← {copy.back}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              {staffName(staff)}
            </h1>
            <SchoolBadge tone={statusTone(staff.employmentStatus)}>
              {statusLabel(locale, staff.employmentStatus)}
            </SchoolBadge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {staff.staffCode || "—"}
            {staff.jobTitle ? ` · ${staff.jobTitle}` : ""}
            {staff.department ? ` · ${staff.department}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => {
                setSelectedAction(action);
                setActionDate(today());
                setActionReason("");
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                ["suspend", "terminate", "archive"].includes(action)
                  ? "border-red-200 text-red-700"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              {copy[action]}
            </button>
          ))}
        </div>
      </header>

      {selectedAction ? (
        <form
          onSubmit={applyLifecycle}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="font-semibold text-slate-950">
            {copy[selectedAction]}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {copy.lifecycleDescription}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[12rem_1fr_auto]">
            <Field label={copy.effectiveDate}>
              <input
                required
                type="date"
                max={today()}
                value={actionDate}
                onChange={(event) => setActionDate(event.target.value)}
                className="staff-input"
              />
            </Field>
            <Field label={copy.reason}>
              <input
                required
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                className="staff-input"
              />
            </Field>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {copy.confirm}
              </button>
              <button
                type="button"
                onClick={() => setSelectedAction(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <nav
        aria-label="Staff record sections"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2"
      >
        {(
          [
            "overview",
            "history",
            "access",
            "assignments",
            "payroll",
            "documents",
            "leaveRequests",
            "medical",
          ] as Tab[]
        ).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${
              tab === value
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {copy[value]}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <form onSubmit={saveRecord} className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title={copy.identity}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.firstName}>
                  <input
                    required
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.lastName}>
                  <input
                    required
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.preferredName}>
                  <input
                    value={preferredName}
                    onChange={(event) => setPreferredName(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.staffCode}>
                  <input
                    value={staffCode}
                    onChange={(event) => setStaffCode(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.phone}>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="staff-input"
                  />
                </Field>
              </div>
            </Panel>

            <Panel title={copy.address}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={copy.addressLine1}>
                    <input
                      value={addressLine1}
                      onChange={(event) => setAddressLine1(event.target.value)}
                      className="staff-input"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={copy.addressLine2}>
                    <input
                      value={addressLine2}
                      onChange={(event) => setAddressLine2(event.target.value)}
                      className="staff-input"
                    />
                  </Field>
                </div>
                <Field label={copy.addressCity}>
                  <input
                    value={addressCity}
                    onChange={(event) => setAddressCity(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.addressRegion}>
                  <input
                    value={addressRegion}
                    onChange={(event) => setAddressRegion(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.addressPostalCode}>
                  <input
                    value={addressPostalCode}
                    onChange={(event) =>
                      setAddressPostalCode(event.target.value)
                    }
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.addressCountryCode}>
                  <input
                    maxLength={2}
                    value={addressCountryCode}
                    onChange={(event) =>
                      setAddressCountryCode(event.target.value.toUpperCase())
                    }
                    className="staff-input uppercase"
                  />
                </Field>
              </div>
            </Panel>
            <Panel title={copy.employment}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.category}>
                  <select
                    value={staffCategory}
                    onChange={(event) =>
                      setStaffCategory(event.target.value as StaffCategory)
                    }
                    className="staff-input"
                  >
                    {options.staffCategories.map((value) => (
                      <option key={value} value={value}>
                        {categoryLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.employmentType}>
                  <select
                    value={employmentType}
                    onChange={(event) =>
                      setEmploymentType(event.target.value as EmploymentType)
                    }
                    className="staff-input"
                  >
                    {options.employmentTypes.map((value) => (
                      <option key={value} value={value}>
                        {employmentTypeLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.hireDate}>
                  <input
                    type="date"
                    max={today()}
                    value={hireDate}
                    onChange={(event) => setHireDate(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.jobTitle}>
                  <input
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.department}>
                  <input
                    list="staff-detail-departments"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.workLocation}>
                  <input
                    value={workLocation}
                    onChange={(event) => setWorkLocation(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.supervisor}>
                  <select
                    value={supervisorId}
                    onChange={(event) => setSupervisorId(event.target.value)}
                    className="staff-input"
                  >
                    <option value="">{copy.noSupervisor}</option>
                    {options.supervisors
                      .filter((option) => option.id !== staffId)
                      .map((option) => (
                        <option key={option.id} value={option.id}>
                          {staffName(option)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={copy.effectiveDate}>
                  <input
                    type="date"
                    max={today()}
                    value={effectiveDate}
                    onChange={(event) => setEffectiveDate(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={copy.changeReason}>
                    <input
                      value={changeReason}
                      onChange={(event) => setChangeReason(event.target.value)}
                      className="staff-input"
                    />
                  </Field>
                </div>
              </div>
            </Panel>
          </div>
          <datalist id="staff-detail-departments">
            {options.departments.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={saving || staff.employmentStatus === "ARCHIVED"}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? copy.saving : copy.save}
          </button>
        </form>
      ) : null}

      {tab === "history" ? (
        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title={copy.statusHistory}>
            <Timeline
              empty={copy.noHistory}
              items={(history?.statusEvents ?? []).map((event) => ({
                id: event.id,
                title: statusLabel(locale, event.newStatus),
                subtitle: event.reason,
                meta: formatDate(event.effectiveDate, locale),
              }))}
            />
          </Panel>
          <Panel title={copy.employmentPeriods}>
            <Timeline
              empty={copy.noHistory}
              items={(history?.employmentPeriods ?? []).map((period) => ({
                id: period.id,
                title: employmentTypeLabel(locale, period.employment_type),
                subtitle:
                  [period.position_title, period.department]
                    .filter(Boolean)
                    .join(" · ") || period.reason,
                meta: `${formatDate(period.start_date, locale)} ${copy.through} ${
                  period.end_date
                    ? formatDate(period.end_date, locale)
                    : copy.present
                }`,
              }))}
            />
          </Panel>
          <Panel title={copy.positions}>
            <Timeline
              empty={copy.noHistory}
              items={(history?.positions ?? []).map((position) => ({
                id: position.id,
                title: position.position_title || "—",
                subtitle:
                  [position.department, position.work_location]
                    .filter(Boolean)
                    .join(" · ") || position.change_reason,
                meta: `${formatDate(position.start_date, locale)} ${copy.through} ${
                  position.end_date
                    ? formatDate(position.end_date, locale)
                    : copy.present
                }`,
              }))}
            />
          </Panel>
        </div>
      ) : null}

      {tab === "access" ||
      tab === "assignments" ||
      tab === "payroll" ||
      tab === "medical" ? (
        <StaffOperationalWorkspaceClient
          schoolId={schoolId}
          staffId={staffId}
          firstName={staff.firstName}
          lastName={staff.lastName}
          email={staff.email}
          section={tab}
        />
      ) : null}

      {tab === "documents" || tab === "leaveRequests" ? (
        <StaffComplianceWorkspaceClient
          schoolId={schoolId}
          staffId={staffId}
          section={tab === "documents" ? "documents" : "leave"}
        />
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">{label}</span>
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

function Timeline({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    meta: string;
  }>;
  empty: string;
}) {
  if (!items.length) return <div className="text-sm text-slate-500">{empty}</div>;
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="border-l-2 border-slate-200 pl-4">
          <div className="font-medium text-slate-900">{item.title}</div>
          <div className="mt-1 text-sm text-slate-600">{item.subtitle}</div>
          <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
        </li>
      ))}
    </ol>
  );
}
function formatDate(value: string, locale: "fr" | "en") {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-HT" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}
