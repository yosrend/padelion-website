import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type GlassProps = HTMLAttributes<HTMLDivElement>;

/**
 * Liquid glass surface. Only over photo or video, never on white,
 * and a maximum of two per screen.
 */
export const Glass = forwardRef<HTMLDivElement, GlassProps>(function Glass(
  { className, children, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cn("pds-glass", className)} {...rest}>
      {children}
    </div>
  );
});
