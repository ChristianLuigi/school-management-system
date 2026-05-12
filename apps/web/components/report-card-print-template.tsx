import { SchoolBadge } from "@/components/school-ui";
import { reportCardLabels } from "@/lib/report-card-labels";
import {
  ReportCardDetails,
  ReportCardLanguage,
} from "@/lib/report-card-types";

function formatScore(value: number | null) {
  if (value === null || Number.isNaN(value)) return "-";
  return value.toFixed(2);
}

function decisionFromAverage(value: number | null, language: ReportCardLanguage) {
  const labels = reportCardLabels(language);

  if (value === null) return labels.pending;
  if (value >= 10) return labels.admitted;
  return labels.watch;
}

function appreciationFromAverage(value: number, language: ReportCardLanguage) {
  const labels = reportCardLabels(language);

  if (value >= 18) return labels.excellent;
  if (value >= 16) return labels.veryGood;
  if (value >= 14) return labels.good;
  if (value >= 10) return labels.passing;
  return labels.insufficient;
}

function i18nName(
  value: Record<string, string> | undefined,
  language: ReportCardLanguage,
  fallback: string,
) {
  return value?.[language] ?? value?.fr ?? value?.en ?? fallback;
}

export function ReportCardPrintTemplate({
  data,
  language,
}: {
  data: ReportCardDetails;
  language: ReportCardLanguage;
}) {
  const labels = reportCardLabels(language);

  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {data.school.branding?.logoUrl ? (
              <img
                src={data.school.branding.logoUrl}
                alt={data.school.name}
                className="h-20 w-20 rounded-2xl object-contain"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xl font-bold text-slate-400 print:bg-white">
                {data.school.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div>
              <div className="text-sm uppercase tracking-[0.2em] text-slate-500">
                {data.school.branding?.reportCardTitleI18n?.[language] ??
                  data.school.branding?.reportCardTitleI18n?.fr ??
                  labels.reportTitle}
              </div>

              <h1 className="mt-2 text-3xl font-bold text-slate-900">
                {data.school.name}
              </h1>

              <div className="mt-1 text-sm text-slate-500">
                {labels.schoolCode}: {data.school.code}
              </div>

              <div className="mt-2 space-y-0.5 text-sm text-slate-500">
                {data.school.branding?.addressLine1 ? (
                  <div>{data.school.branding.addressLine1}</div>
                ) : null}

                {data.school.branding?.addressLine2 ? (
                  <div>{data.school.branding.addressLine2}</div>
                ) : null}

                {data.school.branding?.city ? (
                  <div>{data.school.branding.city}</div>
                ) : null}

                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {data.school.branding?.phone ? (
                    <span>{data.school.branding.phone}</span>
                  ) : null}

                  {data.school.branding?.email ? (
                    <span>{data.school.branding.email}</span>
                  ) : null}

                  {data.school.branding?.website ? (
                    <span>{data.school.branding.website}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <SchoolBadge tone={data.batchStatus === "PUBLISHED" ? "green" : "blue"}>
              {data.batchStatus}
            </SchoolBadge>
            <div className="mt-3 text-sm text-slate-500">
              {labels.generatedOn} {new Date(data.generatedAt).toLocaleDateString()}
            </div>
            {data.publishedAt ? (
              <div className="text-sm text-slate-500">
                {labels.publishedOn}{" "}
                {new Date(data.publishedAt).toLocaleDateString()}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 border-b border-slate-200 py-6 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {labels.student}
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {data.student.firstName ?? ""} {data.student.lastName ?? ""}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {labels.studentCode}: {data.student.code ?? "No student code"}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {labels.class}
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {i18nName(
              data.section.gradeLevelNameI18n,
              language,
              data.section.gradeLevelCode,
            )}{" "}
            - {i18nName(data.section.nameI18n, language, data.section.code)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {data.section.gradeLevelCode} / {data.section.code}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wider text-slate-500">
            {labels.period}
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {i18nName(data.gradingPeriod.nameI18n, language, data.gradingPeriod.id)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 py-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
          <div className="text-sm text-slate-500">{labels.overallAverage}</div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {formatScore(data.averageScore)}
          </div>
          <div className="mt-1 text-xs text-slate-500">{labels.scale}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
          <div className="text-sm text-slate-500">{labels.rank}</div>
          <div className="mt-2 text-4xl font-bold text-slate-900">
            {data.rankInSection ?? "-"}
          </div>
          <div className="mt-1 text-xs text-slate-500">{labels.inSection}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 print:bg-white">
          <div className="text-sm text-slate-500">{labels.decision}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {data.finalDecisionOverride ??
              decisionFromAverage(data.averageScore, language)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600 print:bg-white">
            <tr>
              <th className="px-4 py-3">{labels.subject}</th>
              <th className="px-4 py-3">{labels.coefficient}</th>
              <th className="px-4 py-3">{labels.average}</th>
              <th className="px-4 py-3">{labels.appreciation}</th>
            </tr>
          </thead>
          <tbody>
            {data.subjectResults.map((subject) => (
              <tr key={subject.subjectId} className="border-t border-slate-200">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {i18nName(subject.subjectNameI18n, language, subject.subjectCode)}
                  </div>
                  <div className="text-xs text-slate-500">{subject.subjectCode}</div>
                </td>
                <td className="px-4 py-3">{subject.coefficient}</td>
                <td className="px-4 py-3 font-semibold">
                  {formatScore(subject.average)}
                </td>
                <td className="px-4 py-3">
                  {appreciationFromAverage(subject.average, language)}
                </td>
              </tr>
            ))}
            {data.subjectResults.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  {labels.noSubjectResults}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 py-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-900">
            {labels.attendance}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {labels.attendancePlaceholder}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-900">
            {labels.conduct}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {data.conductNote ?? labels.noConduct}
          </p>
        </div>
      </div>

      <div className="grid gap-6 border-t border-slate-200 py-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-900">
            {labels.teacherComment}
          </div>
          <p className="mt-2 min-h-16 text-sm text-slate-600">
            {data.teacherComment ?? "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-semibold text-slate-900">
            {labels.directorComment}
          </div>
          <p className="mt-2 min-h-16 text-sm text-slate-600">
            {data.directorComment ?? "-"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 p-5 md:col-span-2">
          <div className="text-sm font-semibold text-slate-900">
            {labels.finalRemarks}
          </div>
          <p className="mt-2 min-h-16 text-sm text-slate-600">
            {data.finalRemarks ?? "-"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 border-t border-slate-200 pt-8 md:grid-cols-3">
        <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
          {labels.teacher}
        </div>
        <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
          {data.school.branding?.directorName
            ? `${labels.direction} - ${data.school.branding.directorName}`
            : labels.direction}
        </div>
        <div className="h-24 border-t border-slate-300 pt-2 text-center text-sm text-slate-500">
          {labels.parent}
        </div>
      </div>
      {data.school.branding?.reportCardFooterI18n?.[language] ||
      data.school.branding?.reportCardFooterI18n?.fr ? (
        <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          {data.school.branding.reportCardFooterI18n?.[language] ??
            data.school.branding.reportCardFooterI18n?.fr}
        </div>
      ) : null}
    </div>
  );
}

