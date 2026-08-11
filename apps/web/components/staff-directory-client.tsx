"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { SchoolBadge } from "@/components/school-ui";
import { StaffImportPreviewClient } from "@/components/staff-import-preview-client";
import { createSafeCsv } from "@/lib/csv/safe-csv";
import {
  categoryLabel,
  employmentTypeLabel,
  staffName,
  statusLabel,
  statusTone,
} from "@/lib/staff/presentation";
import type {
  EmploymentType,
  StaffCategory,
  StaffListResponse,
  StaffOptions,
} from "@/lib/staff/types";

const COPY = {
  fr: {
    title: "Répertoire du personnel",
    description:
      "Gérez les dossiers d’emploi, les statuts et les liens opérationnels du personnel.",
    add: "Ajouter un membre",
    reports: "Rapport opérationnel",
    exportDirectory: "Exporter le répertoire",
    importPreview: "Importer un CSV",
    exportingDirectory: "Exportation…",
    exportLimit:
      "L’exportation est limitée à 5 000 membres. Affinez les filtres.",
    close: "Fermer",
    search: "Nom, code, courriel, poste…",
    searchButton: "Rechercher",
    reset: "Réinitialiser",
    allStatuses: "Tous les statuts",
    allCategories: "Toutes les catégories",
    allDepartments: "Tous les départements",
    allAccounts: "Tous les comptes",
    linked: "Compte lié",
    unlinked: "Sans compte",
    loading: "Chargement du personnel…",
    empty: "Aucun membre du personnel ne correspond aux filtres.",
    total: "membres",
    previous: "Précédent",
    next: "Suivant",
    page: "Page",
    identity: "Identité",
    employment: "Emploi",
    firstName: "Prénom",
    lastName: "Nom",
    preferredName: "Nom préféré",
    email: "Courriel",
    phone: "Téléphone",
    address: "Adresse",
    addressLine1: "Adresse principale",
    addressLine2: "Complément d’adresse",
    addressCity: "Ville / Commune",
    addressRegion: "Département / Région",
    addressPostalCode: "Code postal",
    addressCountryCode: "Pays (code à 2 lettres)",
    staffCode: "Code du personnel",
    category: "Catégorie",
    employmentType: "Type d’emploi",
    initialStatus: "Statut initial",
    hireDate: "Date d’embauche",
    jobTitle: "Titre du poste",
    department: "Département",
    workLocation: "Lieu de travail",
    supervisor: "Superviseur",
    noSupervisor: "Aucun superviseur",
    reason: "Motif",
    reasonHint: "Pourquoi ce dossier est-il créé maintenant ?",
    create: "Créer le dossier",
    creating: "Création…",
    account: "Compte",
    noAccount: "Aucun compte",
    payroll: "Paie",
    assignments: "Affectations",
    profile: "Voir le dossier",
    activePayroll: "Profil actif",
    inactivePayroll: "Profil inactif",
    noPayroll: "Aucun profil",
  },
  en: {
    title: "Staff directory",
    description:
      "Manage employment records, statuses, and operational links for school staff.",
    add: "Add staff member",
    reports: "Operational report",
    exportDirectory: "Export directory",
    importPreview: "Import CSV",
    exportingDirectory: "Exporting…",
    exportLimit: "Export is limited to 5,000 staff. Refine the filters.",
    close: "Close",
    search: "Name, code, email, position…",
    searchButton: "Search",
    reset: "Reset",
    allStatuses: "All statuses",
    allCategories: "All categories",
    allDepartments: "All departments",
    allAccounts: "All accounts",
    linked: "Linked account",
    unlinked: "No account",
    loading: "Loading staff…",
    empty: "No staff member matches these filters.",
    total: "staff members",
    previous: "Previous",
    next: "Next",
    page: "Page",
    identity: "Identity",
    employment: "Employment",
    firstName: "First name",
    lastName: "Last name",
    preferredName: "Preferred name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    addressLine1: "Address line 1",
    addressLine2: "Address line 2",
    addressCity: "City / Commune",
    addressRegion: "State / Department / Region",
    addressPostalCode: "Postal code",
    addressCountryCode: "Country (2-letter code)",
    staffCode: "Staff code",
    category: "Category",
    employmentType: "Employment type",
    initialStatus: "Initial status",
    hireDate: "Hire date",
    jobTitle: "Job title",
    department: "Department",
    workLocation: "Work location",
    supervisor: "Supervisor",
    noSupervisor: "No supervisor",
    reason: "Reason",
    reasonHint: "Why is this staff record being created now?",
    create: "Create record",
    creating: "Creating…",
    account: "Account",
    noAccount: "No account",
    payroll: "Payroll",
    assignments: "Assignments",
    profile: "Open record",
    activePayroll: "Active profile",
    inactivePayroll: "Inactive profile",
    noPayroll: "No profile",
  },
} as const;

const EMPTY_OPTIONS: StaffOptions = {
  staffCategories: [],
  employmentTypes: [],
  employmentStatuses: [],
  departments: [],
  supervisors: [],
};

type Filters = {
  search: string;
  employmentStatus: string;
  staffCategory: string;
  department: string;
  accountLink: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  employmentStatus: "",
  staffCategory: "",
  department: "",
  accountLink: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function responseBody(response: Response) {
  return response.json().catch(() => null);
}

export function StaffDirectoryClient({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const { locale } = useI18n();
  const copy = COPY[locale];
  const [data, setData] = useState<StaffListResponse>({
    items: [],
    pagination: { page: 1, pageSize: 25, total: 0, pageCount: 0 },
  });
  const [options, setOptions] = useState<StaffOptions>(EMPTY_OPTIONS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

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
    useState<StaffCategory>("ADMINISTRATIVE");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("FULL_TIME");
  const [employmentStatus, setEmploymentStatus] =
    useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [hireDate, setHireDate] = useState(today());
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [reason, setReason] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        schoolId,
        page: String(page),
        pageSize: "25",
      });
      for (const [key, value] of Object.entries(appliedFilters)) {
        if (value.trim()) query.set(key, value.trim());
      }
      const response = await fetch(
        `/api/staff-management/staff?${query.toString()}`,
        { cache: "no-store" },
      );
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to load staff.");
      }
      setData(body as StaffListResponse);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load staff.",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, schoolId]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    const query = new URLSearchParams({ schoolId });
    void fetch(`/api/staff-management/options?${query.toString()}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await responseBody(response);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load staff options.");
        }
        setOptions(body as StaffOptions);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load staff options.",
        );
      });
  }, [schoolId]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }
  async function exportDirectory() {
    setExporting(true);
    setError("");
    try {
      const items: StaffListResponse["items"] = [];
      let exportPage = 1;
      while (true) {
        const query = new URLSearchParams({
          schoolId,
          page: String(exportPage),
          pageSize: "100",
        });
        for (const [key, value] of Object.entries(appliedFilters)) {
          if (value.trim()) query.set(key, value.trim());
        }
        const response = await fetch(
          `/api/staff-management/staff?${query.toString()}`,
          { cache: "no-store" },
        );
        const body = await responseBody(response);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to export staff.");
        }
        const pageData = body as StaffListResponse;
        if (pageData.pagination.total > 5_000) {
          throw new Error(copy.exportLimit);
        }
        items.push(...pageData.items);
        if (
          items.length >= pageData.pagination.total ||
          exportPage >= pageData.pagination.pageCount
        ) {
          break;
        }
        exportPage += 1;
      }

      const rows: Array<Array<string | number | boolean>> = [
        [
          "staff_code",
          "first_name",
          "last_name",
          "preferred_name",
          "email",
          "phone",
          "staff_category",
          "employment_type",
          "employment_status",
          "hire_date",
          "termination_date",
          "job_title",
          "department",
          "work_location",
          "account_link",
          "account_status",
          "email_verified",
          "payroll_profile",
          "active_assignment_count",
        ],
        ...items.map((staff) => [
          staff.staffCode ?? "",
          staff.firstName ?? "",
          staff.lastName ?? "",
          staff.preferredName ?? "",
          staff.email ?? "",
          staff.phone ?? "",
          staff.staffCategory,
          staff.employmentType,
          staff.employmentStatus,
          staff.hireDate ?? "",
          staff.terminationDate ?? "",
          staff.jobTitle ?? "",
          staff.department ?? "",
          staff.workLocation ?? "",
          staff.account.linked ? "LINKED" : "UNLINKED",
          staff.account.status ?? "",
          staff.account.emailVerified,
          !staff.payroll.hasProfile
            ? "NONE"
            : staff.payroll.active
              ? "ACTIVE"
              : "INACTIVE",
          staff.activeAssignmentCount,
        ]),
      ];
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", createSafeCsv(rows)], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `staff-directory-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to export staff.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/staff-management/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId,
          firstName,
          lastName,
          preferredName: preferredName.trim() || undefined,
          email: email.trim() || undefined,
phone: phone.trim() || undefined,
          addressLine1: addressLine1.trim() || undefined,
          addressLine2: addressLine2.trim() || undefined,
          addressCity: addressCity.trim() || undefined,
          addressRegion: addressRegion.trim() || undefined,
          addressPostalCode: addressPostalCode.trim() || undefined,
          addressCountryCode: addressCountryCode.trim() || undefined,
          staffCode: staffCode.trim() || undefined,
          staffCategory,
          employmentType,
          employmentStatus,
          hireDate:
            employmentStatus === "ACTIVE" ? hireDate || undefined : undefined,
          jobTitle: jobTitle.trim() || undefined,
          department: department.trim() || undefined,
          workLocation: workLocation.trim() || undefined,
          supervisorStaffAccountId: supervisorId || undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const body = await responseBody(response);
      if (!response.ok) {
        throw new Error(body?.message ?? "Unable to create staff record.");
      }
      router.push(`/staff/${body.id}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create staff record.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{copy.title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/staff/reports"
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            {copy.reports}
          </Link>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportDirectory()}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {exporting ? copy.exportingDirectory : copy.exportDirectory}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowImport((value) => !value);
              setShowCreate(false);
            }}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            {showImport ? copy.close : copy.importPreview}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate((value) => !value);
              setShowImport(false);
            }}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {showCreate ? copy.close : copy.add}
          </button>
        </div>
      </div>

      {showImport ? (
        <StaffImportPreviewClient
          schoolId={schoolId}
          onClose={() => setShowImport(false)}
        />
      ) : null}

      {showCreate ? (
        <form
          onSubmit={createStaff}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-6 xl:grid-cols-3">
            <fieldset>
              <legend className="font-semibold text-slate-950">
                {copy.identity}
              </legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                    placeholder="STF-000001"
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
            </fieldset>

            <fieldset>
              <legend className="font-semibold text-slate-950">
                {copy.address}
              </legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            </fieldset>
            <fieldset>
              <legend className="font-semibold text-slate-950">
                {copy.employment}
              </legend>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={copy.category}>
                  <select
                    value={staffCategory}
                    onChange={(event) =>
                      setStaffCategory(event.target.value as StaffCategory)
                    }
                    className="staff-input"
                  >
                    {(options.staffCategories.length
                      ? options.staffCategories
                      : ([
                          "SCHOOL_LEADERSHIP",
                          "TEACHING",
                          "FINANCE",
                          "ADMINISTRATIVE",
                          "STUDENT_SERVICES",
                          "SUPPORT",
                          "CONTRACTOR",
                          "OTHER",
                        ] as StaffCategory[])
                    ).map((value) => (
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
                    {(options.employmentTypes.length
                      ? options.employmentTypes
                      : ([
                          "FULL_TIME",
                          "PART_TIME",
                          "CONTRACT",
                          "TEMPORARY",
                          "VOLUNTEER",
                        ] as EmploymentType[])
                    ).map((value) => (
                      <option key={value} value={value}>
                        {employmentTypeLabel(locale, value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={copy.initialStatus}>
                  <select
                    value={employmentStatus}
                    onChange={(event) =>
                      setEmploymentStatus(
                        event.target.value as "DRAFT" | "ACTIVE",
                      )
                    }
                    className="staff-input"
                  >
                    <option value="DRAFT">
                      {statusLabel(locale, "DRAFT")}
                    </option>
                    <option value="ACTIVE">
                      {statusLabel(locale, "ACTIVE")}
                    </option>
                  </select>
                </Field>
                {employmentStatus === "ACTIVE" ? (
                  <Field label={copy.hireDate}>
                    <input
                      required
                      type="date"
                      max={today()}
                      value={hireDate}
                      onChange={(event) => setHireDate(event.target.value)}
                      className="staff-input"
                    />
                  </Field>
                ) : null}
                <Field label={copy.jobTitle}>
                  <input
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="staff-input"
                  />
                </Field>
                <Field label={copy.department}>
                  <input
                    list="staff-departments"
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
                    {options.supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {staffName(supervisor)}
                        {supervisor.jobTitle ? ` · ${supervisor.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label={copy.reason}>
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={copy.reasonHint}
                      className="staff-input"
                    />
                  </Field>
                </div>
              </div>
            </fieldset>
          </div>

          <datalist id="staff-departments">
            {options.departments.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>

          <button
            type="submit"
            disabled={creating}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {creating ? copy.creating : copy.create}
          </button>
        </form>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(16rem,1fr)_repeat(4,minmax(10rem,auto))_auto]"
      >
        <input
          aria-label={copy.search}
          value={filters.search}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              search: event.target.value,
            }))
          }
          placeholder={copy.search}
          className="staff-input"
        />
        <select
          aria-label={copy.allStatuses}
          value={filters.employmentStatus}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              employmentStatus: event.target.value,
            }))
          }
          className="staff-input"
        >
          <option value="">{copy.allStatuses}</option>
          {options.employmentStatuses.map((value) => (
            <option key={value} value={value}>
              {statusLabel(locale, value)}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.allCategories}
          value={filters.staffCategory}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              staffCategory: event.target.value,
            }))
          }
          className="staff-input"
        >
          <option value="">{copy.allCategories}</option>
          {options.staffCategories.map((value) => (
            <option key={value} value={value}>
              {categoryLabel(locale, value)}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.allDepartments}
          value={filters.department}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              department: event.target.value,
            }))
          }
          className="staff-input"
        >
          <option value="">{copy.allDepartments}</option>
          {options.departments.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label={copy.allAccounts}
          value={filters.accountLink}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              accountLink: event.target.value,
            }))
          }
          className="staff-input"
        >
          <option value="">{copy.allAccounts}</option>
          <option value="LINKED">{copy.linked}</option>
          <option value="UNLINKED">{copy.unlinked}</option>
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            {copy.searchButton}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            {copy.reset}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3 text-sm text-slate-600">
          {data.pagination.total} {copy.total}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {copy.loading}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.items.map((staff) => (
              <article
                key={staff.id}
                className="grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[minmax(15rem,1.3fr)_minmax(12rem,1fr)_minmax(11rem,0.8fr)_auto]"
              >
                <div>
                  <Link
                    href={`/staff/${staff.id}`}
                    className="font-semibold text-slate-950 hover:underline"
                  >
                    {staffName(staff)}
                  </Link>
                  <div className="mt-1 text-sm text-slate-600">
                    {staff.jobTitle || categoryLabel(locale, staff.staffCategory)}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {staff.staffCode || "—"}
                    {staff.email ? ` · ${staff.email}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap content-start gap-2">
                  <SchoolBadge tone={statusTone(staff.employmentStatus)}>
                    {statusLabel(locale, staff.employmentStatus)}
                  </SchoolBadge>
                  <SchoolBadge>
                    {employmentTypeLabel(locale, staff.employmentType)}
                  </SchoolBadge>
                  {staff.department ? (
                    <SchoolBadge tone="blue">{staff.department}</SchoolBadge>
                  ) : null}
                </div>
                <dl className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-500">{copy.account}</dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {staff.account.linked ? copy.linked : copy.noAccount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{copy.payroll}</dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {!staff.payroll.hasProfile
                        ? copy.noPayroll
                        : staff.payroll.active
                          ? copy.activePayroll
                          : copy.inactivePayroll}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{copy.assignments}</dt>
                    <dd className="mt-1 font-medium text-slate-800">
                      {staff.activeAssignmentCount}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-end">
                  <Link
                    href={`/staff/${staff.id}`}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    {copy.profile}
                  </Link>
                </div>
              </article>
            ))}
            {!data.items.length ? (
              <div className="p-10 text-center text-sm text-slate-500">
                {copy.empty}
              </div>
            ) : null}
          </div>
        )}
      </section>

      {data.pagination.pageCount > 1 ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copy.previous}
          </button>
          <div className="text-sm text-slate-600">
            {copy.page} {page} / {data.pagination.pageCount}
          </div>
          <button
            type="button"
            disabled={page >= data.pagination.pageCount || loading}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copy.next}
          </button>
        </div>
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
