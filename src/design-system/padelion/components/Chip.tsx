import { forwardRef, type HTMLAttributes } from "react";
import { BanknotesIcon, CheckCircleIcon, ClockIcon, ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { cn } from "../lib/cn";

export type ChipTone = "paid" | "balance" | "hold" | "urgent" | "neon";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** paid = settled, balance = needs attention, hold = provisional, urgent = ink alert. */
  tone?: ChipTone;
  /** Hide the status icon, for tight spots. */
  plain?: boolean;
}

const ICON = {
  paid: CheckCircleIcon,
  balance: BanknotesIcon,
  hold: ClockIcon,
  urgent: ExclamationTriangleIcon,
  neon: SparklesIcon,
} as const;

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { tone = "paid", plain = false, className, children, ...rest },
  ref,
) {
  const Icon = ICON[tone];
  return (
    <span ref={ref} className={cn("pds-chip", `pds-chip--${tone}`, className)} {...rest}>
      {plain ? null : <Icon className="pds-chip__icon" aria-hidden="true" />}
      {children}
    </span>
  );
});
