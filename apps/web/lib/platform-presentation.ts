import type { Locale } from "./i18n/messages";

const labels: Record<string, [string, string]> = {
  ACTIVE: ["Active", "Active"], DRAFT: ["Brouillon", "Draft"],
  ACTIVE_SETUP: ["En configuration", "In setup"], SUSPENDED: ["Suspendue", "Suspended"],
  ARCHIVED: ["Archivée", "Archived"], INVITED: ["Invité", "Invited"],
  SELF_MANAGED: ["Autonome", "Self-managed"], SUPERADMIN_MANAGED: ["Gérée par ALMAC", "ALMAC-managed"],
  HYBRID_MANAGED: ["Gestion partagée", "Shared management"],
};

export function platformLabel(value: string, locale: Locale) {
  return labels[value]?.[locale === "fr" ? 0 : 1] ?? value;
}

export function filterPlatformSchools<T extends { name: string; code: string; status: string; management_mode: string }>(
  schools: T[], search: string, status: string, mode: string,
) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const term = normalize(search.trim());
  return schools.filter(school => (!status || school.status === status) && (!mode || school.management_mode === mode) && normalize(`${school.name} ${school.code}`).includes(term));
}
