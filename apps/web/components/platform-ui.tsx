import Link from "next/link";
import { ReactNode } from "react";
import { ArrowUpRight, Inbox } from "lucide-react";
import { PlatformValueLabel } from "@/components/platform-value-label";
import { buttonStyles } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export function PlatformPageHeader({
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

export function PlatformPanel({
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

export function PlatformStatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold text-foreground">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function PlatformBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const styles = {
    neutral: "bg-surface-muted text-foreground",
    green: "bg-success-subtle text-success",
    amber: "bg-warning-subtle text-warning",
    red: "bg-danger-subtle text-danger",
    blue: "bg-info-subtle text-info",
  };

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${styles[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return <PlatformBadge tone="green"><PlatformValueLabel value={status} /></PlatformBadge>;
  }

  if (status === "ACTIVE_SETUP") {
    return <PlatformBadge tone="amber"><PlatformValueLabel value={status} /></PlatformBadge>;
  }

  if (status === "SUSPENDED") {
    return <PlatformBadge tone="red"><PlatformValueLabel value={status} /></PlatformBadge>;
  }

  if (status === "ARCHIVED") {
    return <PlatformBadge tone="neutral"><PlatformValueLabel value={status} /></PlatformBadge>;
  }

  return <PlatformBadge><PlatformValueLabel value={status} /></PlatformBadge>;
}

export function ManagementModeBadge({ mode }: { mode: string }) {
  if (mode === "SUPERADMIN_MANAGED") {
    return <PlatformBadge tone="blue"><PlatformValueLabel value={mode} /></PlatformBadge>;
  }

  if (mode === "HYBRID_MANAGED") {
    return <PlatformBadge tone="amber"><PlatformValueLabel value={mode} /></PlatformBadge>;
  }

  return <PlatformBadge><PlatformValueLabel value={mode} /></PlatformBadge>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-input bg-surface-muted p-8 text-center">
      <Inbox size={28} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
      <div className="text-lg font-semibold text-foreground">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PlatformPrimaryLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={buttonStyles('primary')}
    >
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}
