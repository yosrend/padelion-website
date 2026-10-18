import { forwardRef, type ComponentType, type HTMLAttributes, type SVGProps } from "react";
import { cn } from "../lib/cn";

export interface KpiCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  sub?: string;
  /** Heroicon outline component shown beside the label. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export const KpiCard = forwardRef<HTMLDivElement, KpiCardProps>(function KpiCard(
  { label, value, sub, icon: Icon, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("pds-kpi", className)} {...rest}>
      <div className="pds-kpi__meta">
        {Icon ? <Icon aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <p className="pds-kpi__value">{value}</p>
      {sub ? <p className="pds-kpi__sub">{sub}</p> : null}
    </div>
  );
});
