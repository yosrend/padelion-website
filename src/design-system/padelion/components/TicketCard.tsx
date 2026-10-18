import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Chip } from "./Chip";

export interface TicketDetail {
  label: string;
  value: string;
}

export interface TicketCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Neon status chip at the top, for example "Paid in full". */
  status: string;
  /** Large 64px line, for example "20.00". */
  title: string;
  /** Secondary line under the title. */
  subtitle?: ReactNode;
  /** Exactly three details render in the bottom band. */
  details: TicketDetail[];
}

export const TicketCard = forwardRef<HTMLDivElement, TicketCardProps>(function TicketCard(
  { status, title, subtitle, details, className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("pds-ticket", className)} {...rest}>
      <div className="pds-ticket__top">
        <Chip tone="neon">{status}</Chip>
        <p className="pds-ticket__title">{title}</p>
        {subtitle ? <p className="pds-ticket__sub">{subtitle}</p> : null}
        {children}
      </div>
      <div className="pds-ticket__band">
        {details.map((d) => (
          <div key={d.label}>
            <p className="pds-ticket__label">{d.label}</p>
            <p className="pds-ticket__value">{d.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
