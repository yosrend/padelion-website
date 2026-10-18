import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type TimelineBlockState = "paid" | "balance" | "hold";

export interface TimelineBlock {
  label: string;
  state: TimelineBlockState;
}

export interface TimelineRow {
  court: string;
  blocks: TimelineBlock[];
}

export interface TimelineProps extends HTMLAttributes<HTMLDivElement> {
  rows: TimelineRow[];
}

/** Desk timeline. Rows are courts, blocks are bookings across the day. */
export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  { rows, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("pds-timeline", className)} {...rest}>
      {rows.map((row) => (
        <div className="pds-timeline__row" key={row.court}>
          <div className="pds-timeline__court">{row.court}</div>
          <div className="pds-timeline__track">
            {row.blocks.map((b) => (
              <div
                key={`${row.court}-${b.label}`}
                className={cn("pds-timeline__block", `pds-timeline__block--${b.state}`)}
              >
                {b.label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
