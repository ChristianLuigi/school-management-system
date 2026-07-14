import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5 sm:pb-6 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 text-sm text-muted-foreground"
          >
            {breadcrumbs}
          </nav>
        ) : null}

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>

        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div
          role="group"
          aria-label="Page actions"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
