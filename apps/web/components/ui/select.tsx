"use client";

import {
  forwardRef,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";
import { useFieldControl } from "@/components/ui/field";
import {
  cn,
  formControlClassName,
} from "@/components/ui/form-control-styles";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    className,
    containerClassName,
    id,
    required,
    disabled,
    "aria-describedby": describedBy,
    "aria-errormessage": errorMessage,
    "aria-invalid": invalid,
    children,
    ...props
  },
  ref,
) {
  const field = useFieldControl({
    id,
    describedBy,
    errorMessage,
    invalid,
    required,
    disabled,
  });

  return (
    <span className={cn("relative block", containerClassName)}>
      <select
        ref={ref}
        className={cn(
          formControlClassName,
          "peer h-10 appearance-none px-3 py-2 pr-10 text-sm forced-colors:appearance-auto",
          className,
        )}
        {...props}
        {...field.controlProps}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors peer-disabled:opacity-50 peer-aria-invalid:text-danger forced-colors:hidden"
      />
    </span>
  );
});

Select.displayName = "Select";
