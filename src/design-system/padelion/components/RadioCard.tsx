import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface RadioCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Payment choice card. Selected state is the only place blue appears here. */
export const RadioCard = forwardRef<HTMLButtonElement, RadioCardProps>(function RadioCard(
  { selected = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="radio"
      aria-checked={selected}
      className={cn("pds-radio-card", selected && "pds-radio-card--selected", className)}
      {...rest}
    >
      <span className="pds-radio-card__dot" aria-hidden="true" />
      <span>{children}</span>
    </button>
  );
});
