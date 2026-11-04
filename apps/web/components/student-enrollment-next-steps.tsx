"use client";

import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { enrollmentNextSteps } from "@/lib/students/enrollment-draft";

export function StudentEnrollmentNextSteps({
  hasGuardian,
  hasPlacement,
  documentsReceived,
  onSelect,
}: {
  hasGuardian: boolean;
  hasPlacement: boolean;
  documentsReceived: number;
  onSelect: (tab: "guardians" | "enrollment" | "documents") => void;
}) {
  const { t } = useI18n();
  const items = enrollmentNextSteps({
    hasGuardian,
    hasPlacement,
    documentsReceived,
  });
  return (
    <section
      aria-labelledby="enrollment-next-steps"
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <h2 id="enrollment-next-steps" className="font-semibold text-foreground">
        {t("students.create.nextSteps")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("students.create.progressHint")}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => onSelect(item.tab)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-border p-3 text-left text-sm hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.done ? (
              <CheckCircle2
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-success"
              />
            ) : (
              <Circle
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-warning"
              />
            )}
            <span className="flex-1">
              <span className="block font-medium">{t(item.label)}</span>
              <span className="text-xs text-muted-foreground">
                {item.done
                  ? t("students.create.recorded")
                  : item.tab === "documents"
                    ? t("students.create.documentsProgress", {
                        count: documentsReceived,
                      })
                    : t("students.create.toComplete")}
              </span>
            </span>
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </button>
        ))}
      </div>
    </section>
  );
}
