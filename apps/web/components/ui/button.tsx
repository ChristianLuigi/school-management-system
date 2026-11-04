import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

export function buttonStyles(variant: 'primary' | 'secondary' | 'danger' | 'ghost' = 'secondary', size: 'default' | 'icon' = 'default') {
  return cn(
    'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-[background-color,box-shadow,transform] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px motion-reduce:transform-none',
    size === 'icon' ? 'size-11 p-2' : 'px-4 py-2.5',
    variant === 'primary' ? 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover' :
    variant === 'danger' ? 'bg-danger text-danger-foreground shadow-xs hover:brightness-95' :
    variant === 'ghost' ? 'text-foreground hover:bg-surface-muted' : 'border border-border-strong bg-surface text-foreground shadow-xs hover:bg-surface-muted',
  );
}

export function Button({ variant = 'secondary', size = 'default', type = 'button', className, ...props }: ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'default' | 'icon';
}) {
  return <button data-slot="button" type={type} className={cn(buttonStyles(variant, size), className)} {...props} />;
}
