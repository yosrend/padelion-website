import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** public = 24px radius editorial card, desk = 14px dashboard card. */
  surface?: "public" | "desk";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { surface = "desk", className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn("pds-card", surface === "public" && "pds-card--public", className)}
      {...rest}
    >
      {children}
    </div>
  );
});
