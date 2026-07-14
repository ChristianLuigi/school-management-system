import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CardElement = "article" | "section" | "div";
type CardHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: CardElement;
};

export function Card({
  as: Component = "article",
  className,
  ...props
}: CardProps) {
  return (
    <Component
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("grid gap-1.5 p-4 sm:p-5", className)}
      {...props}
    />
  );
}

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  headingLevel?: CardHeadingLevel;
};

export function CardTitle({
  headingLevel = 3,
  className,
  ...props
}: CardTitleProps) {
  const Heading = `h${headingLevel}` as const;

  return (
    <Heading
      data-slot="card-title"
      className={cn(
        "text-base font-semibold leading-6 tracking-tight text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-4 pb-4 first:pt-4 sm:px-5 sm:pb-5 sm:first:pt-5",
        className,
      )}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border bg-surface-muted/50 px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}
