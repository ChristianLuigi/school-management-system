import type { HTMLAttributes, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Trend = "up" | "down" | "neutral";
type StatHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type StatCardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  iconLabel?: string;
  trend?: Trend;
  trendIndicator?: ReactNode;
  headingLevel?: StatHeadingLevel;
};

const trendStyles: Record<Trend, string> = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
};

const trendLabels: Record<Trend, string> = {
  up: "Increasing trend",
  down: "Decreasing trend",
  neutral: "No change",
};

export function StatCard({
  title,
  value,
  icon,
  iconLabel,
  trend = "neutral",
  trendIndicator,
  headingLevel = 3,
  className,
  ...props
}: StatCardProps) {
  const Heading = `h${headingLevel}` as const;
  const TrendIcon = trendIcons[trend];

  return (
    <Card
      as="article"
      className={cn("min-w-0", className)}
      {...props}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <Heading className="min-w-0 text-sm font-medium leading-5 text-muted-foreground">
            {title}
          </Heading>

          {icon ? (
            <span
              role={iconLabel ? "img" : undefined}
              aria-hidden={iconLabel ? undefined : true}
              aria-label={iconLabel}
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"
            >
              {icon}
            </span>
          ) : null}
        </div>

        <div className="mt-2 text-2xl font-semibold tracking-tight text-card-foreground tabular-nums sm:text-3xl">
          {value}
        </div>

        {trendIndicator ? (
          <div
            className={cn(
              "mt-2 flex items-center gap-1 text-xs font-medium leading-5",
              trendStyles[trend],
            )}
          >
            <TrendIcon aria-hidden="true" size={14} strokeWidth={2.25} />
            <span>
              <span className="sr-only">{trendLabels[trend]}: </span>
              {trendIndicator}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
