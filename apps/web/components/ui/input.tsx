"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
} from "react";
import { useFieldControl } from "@/components/ui/field";
import {
  cn,
  formControlClassName,
} from "@/components/ui/form-control-styles";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    id,
    required,
    disabled,
    "aria-describedby": describedBy,
    "aria-errormessage": errorMessage,
    "aria-invalid": invalid,
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
    <input
      ref={ref}
      className={cn(formControlClassName, "h-10 px-3 py-2 text-sm", className)}
      {...props}
      {...field.controlProps}
    />
  );
});

Input.displayName = "Input";
