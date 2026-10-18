import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type SlotState = "open" | "taken" | "selected" | "range-end";

export interface SlotProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Start time, written as 20.00 */
  time: string;
  state?: SlotState;
  /** End label for a range end, written as "to 21.30" */
  endLabel?: string;
}

export const Slot = forwardRef<HTMLButtonElement, SlotProps>(function Slot(
  { time, state = "open", endLabel, className, type = "button", ...rest },
  ref,
) {
  const taken = state === "taken";
  return (
    <button
      ref={ref}
      type={type}
      disabled={taken || rest.disabled}
      aria-pressed={state === "selected" || state === "range-end"}
      className={cn("pds-slot", `pds-slot--${state}`, className)}
      {...rest}
    >
      <span>{taken ? "Taken" : time}</span>
      {state === "range-end" && endLabel ? (
        <span className="pds-slot__end">{endLabel}</span>
      ) : null}
    </button>
  );
});

export type SlotGridProps = HTMLAttributes<HTMLDivElement>;

export const SlotGrid = forwardRef<HTMLDivElement, SlotGridProps>(function SlotGrid(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("pds-slot-grid", className)} {...rest}>
      {children}
    </div>
  );
});
