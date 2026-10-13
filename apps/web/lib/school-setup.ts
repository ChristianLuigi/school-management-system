export function canBootstrapSchool(status: { school: { status: string }; counts: { academicYears: number } } | null) {
  return !!status && ['DRAFT', 'ACTIVE_SETUP'].includes(status.school.status) && status.counts.academicYears === 0;
}

/** Divide the selected inclusive year into three consecutive, non-overlapping periods. */
export function buildSetupPeriods(start: string, end: string) {
  const day = 86400000;
  const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`);
  const count = Math.round((last - first) / day) + 1;
  if (!Number.isFinite(count) || count < 3) throw new Error('Invalid academic year range');
  const date = (offset: number) => new Date(first + offset * day).toISOString().slice(0, 10);
  return [0, 1, 2].map(index => ({
    code: `T${index + 1}`,
    nameI18n: { fr: `${index + 1}${index === 0 ? 'er' : 'e'} trimestre`, en: `Trimester ${index + 1}` },
    startDate: date(Math.floor(index * count / 3)),
    endDate: date(Math.floor((index + 1) * count / 3) - 1),
    displayOrder: index + 1,
  }));
}
