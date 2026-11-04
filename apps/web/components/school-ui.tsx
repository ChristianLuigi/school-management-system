import Link from "next/link";
import { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export function schoolActionClass(
  variant: "primary" | "secondary" = "secondary",
) {
  return buttonStyles(variant);
}

export function SchoolFeedback({
  children,
  action,
  tone = "error",
}: {
  children: ReactNode;
  action?: ReactNode;
  tone?: "error" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm " +
        (tone === "error"
          ? "border-danger/40 bg-danger-subtle text-danger"
          : "border-success/40 bg-success-subtle text-success")
      }
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

export function SchoolPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <PageHeader title={title} description={description} actions={action} />
  );
}

export function SchoolPanel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 text-foreground shadow-xs sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>

        {action ? <div>{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

export function SchoolStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export type SchoolBadgeTone = "neutral" | "green" | "amber" | "red" | "blue";

export function SchoolBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: SchoolBadgeTone;
}) {
  const styles = {
    neutral: "bg-surface-muted text-foreground",
    green: "bg-success-subtle text-success",
    amber: "bg-warning-subtle text-warning",
    red: "bg-danger-subtle text-danger",
    blue: "bg-info-subtle text-info",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-surface p-5 shadow-xs transition hover:border-input hover:bg-surface-muted hover:shadow-sm"
    >
      <div className="text-base font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export function EmptySchoolState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-surface p-8 text-center">
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-3 flex justify-center text-muted-foreground"
        >
          {icon}
        </div>
      ) : null}
      <div className="text-lg font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
