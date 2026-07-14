import { cn } from "@/lib/cn";

export { cn } from "@/lib/cn";

export const formControlClassName = cn(
  "w-full rounded-md border border-input bg-surface text-foreground shadow-xs outline-none",
  "transition-[background-color,border-color,box-shadow,color] duration-150",
  "placeholder:text-muted-foreground",
  "hover:border-border-strong",
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "aria-invalid:border-danger aria-invalid:focus-visible:border-danger",
  "aria-invalid:focus-visible:ring-danger/25",
  "disabled:cursor-not-allowed disabled:border-input disabled:bg-surface-muted",
  "disabled:text-muted-foreground disabled:opacity-70 disabled:hover:border-input",
  "read-only:bg-surface-muted read-only:text-muted-foreground",
);
