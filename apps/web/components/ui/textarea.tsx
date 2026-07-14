"use client";

import {
  forwardRef,
  type TextareaHTMLAttributes,
} from "react";
import { useFieldControl } from "@/components/ui/field";
import {
  cn,
  formControlClassName,
} from "@/components/ui/form-control-styles";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      className,
      id,
      required,
      disabled,
      "aria-describedby": describedBy,
      "aria-errormessage": errorMessage,
      "aria-invalid": invalid,
      rows = 4,
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
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          formControlClassName,
          "min-h-24 resize-y px-3 py-2 text-sm",
          className,
        )}
        {...props}
        {...field.controlProps}
      />
    );
  },
);

Textarea.displayName = "Textarea";
