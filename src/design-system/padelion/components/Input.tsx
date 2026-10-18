import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { ExclamationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Error message. When set, the field is marked invalid and the message replaces the hint. */
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="pds-field">
      <label className="pds-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-describedby={errorId ?? hintId}
        aria-invalid={error ? true : undefined}
        className={cn("pds-input", className)}
        {...rest}
      />
      {error ? (
        <span id={errorId} className="pds-field__error" role="alert">
          <ExclamationCircleIcon aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="pds-field__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
});
