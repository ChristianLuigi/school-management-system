import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type SectionHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  headingLevel?: SectionHeadingLevel;
};

export function SectionHeader({
  title,
  description,
  actions,
  headingLevel = 2,
  className,
  ...props
}: SectionHeaderProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        <Heading className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div
          role="group"
          aria-label="Section actions"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
