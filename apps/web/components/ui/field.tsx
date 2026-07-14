"use client";

import {
  cloneElement,
  createContext,
  forwardRef,
  type AriaAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
} from "react";
import { cn } from "@/components/ui/form-control-styles";

type AriaInvalid = AriaAttributes["aria-invalid"];

type FieldContextValue = {
  controlId: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

type FieldControlElementProps = {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
  "aria-invalid"?: AriaInvalid;
};

export type FieldProps = Omit<HTMLAttributes<HTMLDivElement>, "children" | "id"> & {
  id?: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  children: ReactElement<FieldControlElementProps>;
  labelClassName?: string;
  descriptionClassName?: string;
  errorClassName?: string;
};

type UseFieldControlOptions = {
  id?: string;
  describedBy?: string;
  errorMessage?: string;
  invalid?: AriaInvalid;
  required?: boolean;
  disabled?: boolean;
};

function mergeIds(...values: Array<string | undefined>) {
  const ids = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .filter(Boolean);

  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}

function isInvalid(value: AriaInvalid | undefined) {
  return (
    value === true ||
    value === "true" ||
    value === "grammar" ||
    value === "spelling"
  );
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldControl({
  id,
  describedBy,
  errorMessage,
  invalid,
  required,
  disabled,
}: UseFieldControlOptions) {
  const field = useContext(FieldContext);
  const effectiveInvalid = Boolean(field?.invalid || isInvalid(invalid));

  return {
    invalid: effectiveInvalid,
    controlProps: {
      id: id ?? field?.controlId,
      "aria-describedby": mergeIds(
        describedBy,
        field?.descriptionId,
        field?.errorId,
      ),
      "aria-errormessage": errorMessage ?? field?.errorId,
      "aria-invalid": effectiveInvalid ? true : invalid,
      required: required ?? field?.required,
      disabled: disabled ?? field?.disabled,
    },
  };
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    id,
    label,
    description,
    error,
    required,
    disabled,
    children,
    className,
    labelClassName,
    descriptionClassName,
    errorClassName,
    ...props
  },
  ref,
) {
  const generatedId = useId().replace(/:/g, "");
  const controlId = id ?? children.props.id ?? `field-${generatedId}`;
  const hasDescription = description !== undefined && description !== null;
  const hasError = error !== undefined && error !== null;
  const descriptionId = hasDescription ? `${controlId}-description` : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;
  const effectiveRequired = required ?? children.props.required ?? false;
  const effectiveDisabled = disabled ?? children.props.disabled ?? false;
  const effectiveInvalid = hasError || isInvalid(children.props["aria-invalid"]);

  const control = cloneElement(children, {
    id: controlId,
    required: effectiveRequired,
    disabled: effectiveDisabled,
    "aria-describedby": mergeIds(
      children.props["aria-describedby"],
      descriptionId,
      errorId,
    ),
    "aria-errormessage": errorId ?? children.props["aria-errormessage"],
    "aria-invalid": effectiveInvalid
      ? true
      : children.props["aria-invalid"],
  });

  return (
    <FieldContext.Provider
      value={{
        controlId,
        descriptionId,
        errorId,
        invalid: effectiveInvalid,
        required: effectiveRequired,
        disabled: effectiveDisabled,
      }}
    >
      <div
        ref={ref}
        data-disabled={effectiveDisabled ? "" : undefined}
        data-invalid={effectiveInvalid ? "" : undefined}
        className={cn("grid gap-2", className)}
        {...props}
      >
        <label
          htmlFor={controlId}
          className={cn(
            "w-fit text-sm font-medium text-foreground",
            effectiveDisabled && "cursor-not-allowed text-muted-foreground",
            labelClassName,
          )}
        >
          {label}
          {effectiveRequired ? (
            <span aria-hidden="true" className="ml-1 text-danger">
              *
            </span>
          ) : null}
        </label>

        {hasDescription ? (
          <p
            id={descriptionId}
            className={cn("text-sm text-muted-foreground", descriptionClassName)}
          >
            {description}
          </p>
        ) : null}

        {control}

        {hasError ? (
          <p
            id={errorId}
            role="alert"
            className={cn("text-sm font-medium text-danger", errorClassName)}
          >
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
});

Field.displayName = "Field";
