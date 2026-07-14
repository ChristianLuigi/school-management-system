"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Check, Minus } from "lucide-react";
import { useFieldControl } from "@/components/ui/field";
import { cn } from "@/components/ui/form-control-styles";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  containerClassName?: string;
  indeterminate?: boolean;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      className,
      containerClassName,
      id,
      required,
      disabled,
      indeterminate = false,
      "aria-describedby": describedBy,
      "aria-errormessage": errorMessage,
      "aria-invalid": invalid,
      ...props
    },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLInputElement | null>(null);
    const field = useFieldControl({
      id,
      describedBy,
      errorMessage,
      invalid,
      required,
      disabled,
    });

    const setRef = useCallback(
      (node: HTMLInputElement | null) => {
        localRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    useEffect(() => {
      if (localRef.current) {
        localRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    return (
      <span
        className={cn(
          "relative inline-flex size-5 shrink-0",
          containerClassName,
        )}
      >
        <input
          ref={setRef}
          type="checkbox"
          aria-checked={indeterminate ? "mixed" : undefined}
          className={cn(
            "peer size-5 shrink-0 appearance-none rounded-[0.3rem] border border-input bg-surface shadow-xs outline-none",
            "transition-[background-color,border-color,box-shadow] duration-150",
            "hover:border-border-strong checked:border-primary checked:bg-primary",
            "indeterminate:border-primary indeterminate:bg-primary",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
            "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "aria-invalid:border-danger aria-invalid:checked:border-danger",
            "aria-invalid:focus-visible:ring-danger/25",
            "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
            "forced-colors:appearance-auto",
            className,
          )}
          {...props}
          {...field.controlProps}
        />
        {indeterminate ? (
          <Minus
            aria-hidden="true"
            size={14}
            strokeWidth={3}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground peer-disabled:opacity-70 forced-colors:hidden"
          />
        ) : (
          <Check
            aria-hidden="true"
            size={14}
            strokeWidth={3}
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100 peer-disabled:opacity-70 forced-colors:hidden"
          />
        )}
      </span>
    );
  },
);

Checkbox.displayName = "Checkbox";
