import type {
  EmploymentStatus,
  EmploymentType,
  StaffCategory,
} from "@/lib/staff/types";

type Locale = "fr" | "en";

const STATUS_LABELS: Record<Locale, Record<EmploymentStatus, string>> = {
  fr: {
    DRAFT: "Brouillon",
    ACTIVE: "Actif",
    ON_LEAVE: "En congé",
    SUSPENDED: "Suspendu",
    TERMINATED: "Terminé",
    ARCHIVED: "Archivé",
  },
  en: {
    DRAFT: "Draft",
    ACTIVE: "Active",
    ON_LEAVE: "On leave",
    SUSPENDED: "Suspended",
    TERMINATED: "Terminated",
    ARCHIVED: "Archived",
  },
};

const CATEGORY_LABELS: Record<Locale, Record<StaffCategory, string>> = {
  fr: {
    SCHOOL_LEADERSHIP: "Direction",
    TEACHING: "Enseignement",
    FINANCE: "Finances",
    ADMINISTRATIVE: "Administration",
    STUDENT_SERVICES: "Services aux élèves",
    SUPPORT: "Soutien",
    CONTRACTOR: "Prestataire",
    OTHER: "Autre",
  },
  en: {
    SCHOOL_LEADERSHIP: "School leadership",
    TEACHING: "Teaching",
    FINANCE: "Finance",
    ADMINISTRATIVE: "Administration",
    STUDENT_SERVICES: "Student services",
    SUPPORT: "Support",
    CONTRACTOR: "Contractor",
    OTHER: "Other",
  },
};

const EMPLOYMENT_LABELS: Record<Locale, Record<EmploymentType, string>> = {
  fr: {
    FULL_TIME: "Temps plein",
    PART_TIME: "Temps partiel",
    CONTRACT: "Contrat",
    TEMPORARY: "Temporaire",
    VOLUNTEER: "Bénévole",
  },
  en: {
    FULL_TIME: "Full time",
    PART_TIME: "Part time",
    CONTRACT: "Contract",
    TEMPORARY: "Temporary",
    VOLUNTEER: "Volunteer",
  },
};

export function statusLabel(locale: Locale, value: EmploymentStatus) {
  return STATUS_LABELS[locale][value];
}

export function categoryLabel(locale: Locale, value: StaffCategory) {
  return CATEGORY_LABELS[locale][value];
}

export function employmentTypeLabel(locale: Locale, value: EmploymentType) {
  return EMPLOYMENT_LABELS[locale][value];
}

export function staffName(input: {
  firstName: string | null;
  lastName: string | null;
  preferredName?: string | null;
  staffCode?: string | null;
}) {
  return (
    [input.preferredName || input.firstName, input.lastName]
      .filter(Boolean)
      .join(" ") ||
    input.staffCode ||
    "—"
  );
}

export function statusTone(status: EmploymentStatus) {
  if (status === "ACTIVE") return "green" as const;
  if (status === "ON_LEAVE" || status === "DRAFT") return "amber" as const;
  if (status === "SUSPENDED" || status === "TERMINATED")
    return "red" as const;
  return "neutral" as const;
}
