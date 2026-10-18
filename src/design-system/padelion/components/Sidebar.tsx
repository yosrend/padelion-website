import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type SVGProps,
} from "react";
import { cn } from "../lib/cn";

export type SidebarProps = HTMLAttributes<HTMLElement>;

/** 248px desk sidebar. Compose SidebarItem children and a SidebarFooter. */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { className, children, ...rest },
  ref,
) {
  return (
    <nav ref={ref} className={cn("pds-sidebar", className)} {...rest}>
      {children}
    </nav>
  );
});

export interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  active?: boolean;
  badge?: string;
}

export const SidebarItem = forwardRef<HTMLButtonElement, SidebarItemProps>(
  function SidebarItem({ icon: Icon, label, active = false, badge, className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-current={active ? "page" : undefined}
        className={cn("pds-sidebar__item", active && "pds-sidebar__item--active", className)}
        {...rest}
      >
        <Icon aria-hidden="true" />
        <span>{label}</span>
        {badge ? <span className="pds-sidebar__badge">{badge}</span> : null}
      </button>
    );
  },
);

export type SidebarFooterProps = HTMLAttributes<HTMLDivElement>;

export const SidebarFooter = forwardRef<HTMLDivElement, SidebarFooterProps>(
  function SidebarFooter({ className, children, ...rest }, ref) {
    return (
      <div ref={ref} className={cn("pds-sidebar__footer", className)} {...rest}>
        {children}
      </div>
    );
  },
);
