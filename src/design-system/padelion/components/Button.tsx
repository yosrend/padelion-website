import { forwardRef, type ButtonHTMLAttributes, type ComponentType, type SVGProps } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "selection";
export type ButtonSurface = "public" | "desk";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one neon action per screen. selection = a choice already made. */
  variant?: ButtonVariant;
  /** public pages use 54px pills, the dashboard uses 40px 10px-radius buttons. */
  surface?: ButtonSurface;
  /** Heroicon outline component, rendered at 18px before the label. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", surface = "public", icon: Icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn("pds-btn", `pds-btn--${surface}`, `pds-btn--${variant}`, className)}
      {...rest}
    >
      {Icon ? <Icon className="pds-btn__icon" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
