import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import {
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BanknotesIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  QueueListIcon,
  QrCodeIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Sidebar, SidebarFooter, SidebarItem } from "@/design-system/padelion";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { getStaffMe, type StaffMe } from "@/lib/staff";
import { deskChecksKey, fetchChecksCount } from "@/lib/desk";

export const Route = createFileRoute("/_staff")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getStaffMe();
    if (!me) {
      await supabase.auth.signOut();
      throw redirect({ to: "/staff/login" });
    }
    return { me };
  },
  component: StaffLayout,
});

type NavItem = {
  label: string;
  short?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  to: string;
  params?: { section: string };
  owner?: boolean;
  badge?: boolean;
  external?: boolean;
};

const NAV: NavItem[] = [
  { label: "Today", icon: HomeIcon, to: "/desk" },
  { label: "Bookings", icon: QueueListIcon, to: "/desk/bookings" },
  { label: "Payments to check", short: "Payments", icon: BanknotesIcon, to: "/desk/payments", badge: true },
  { label: "Courts and blocks", short: "Courts", icon: Squares2X2Icon, to: "/desk/courts" },
  { label: "Waitlist", icon: UsersIcon, to: "/desk/waitlist" },
  { label: "Check-in screen", icon: QrCodeIcon, to: "/checkin", external: true },
  { label: "This week", icon: ChartBarIcon, to: "/owner", owner: true },
  { label: "Prices and staff", icon: Cog6ToothIcon, to: "/owner/settings", owner: true },
];

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function StaffNav({ me, onPick }: { me: StaffMe; onPick?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const { data: checks } = useQuery({ queryKey: deskChecksKey, queryFn: fetchChecksCount });

  return (
    <Sidebar aria-label="Staff">
      <a href="/" className="sbrand" aria-label="Padelion, open the public site">
        <Logo className="brand__logo" />
        <span className="sbrand__tag">{me.role === "owner" ? "Owner" : "Desk"}</span>
      </a>
      <p className="sgroup">Run the day</p>
      {NAV.filter((n) => !n.owner).map((n) => (
        <SidebarItem
          key={n.label}
          icon={n.icon}
          label={n.label}
          active={pathname === n.to}
          badge={n.badge && checks ? String(checks) : undefined}
          onClick={() => {
            onPick?.();
            if (n.external) window.open(n.to, "_blank", "noopener");
            else navigate({ to: n.to as "/desk" });
          }}
        />
      ))}
      {me.role === "owner" ? (
        <>
          <p className="sgroup">Owner</p>
          {NAV.filter((n) => n.owner).map((n) => (
            <SidebarItem
              key={n.label}
              icon={n.icon}
              label={n.label}
              active={pathname === n.to}
              onClick={() => {
                onPick?.();
                navigate({ to: n.to as "/desk" });
              }}
            />
          ))}
        </>
      ) : null}
      <SidebarFooter>
        <div className="suser">
          <span className="suser__avatar" aria-hidden="true">{initials(me.name)}</span>
          <div className="suser__text">
            <p className="suser__name">{me.name}</p>
            <p className="suser__role">{me.role === "owner" ? "Owner" : "Front desk"}</p>
          </div>
          <button
            type="button"
            className="suser__out"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
              navigate({ to: "/staff/login", replace: true });
            }}
          >
            <ArrowRightStartOnRectangleIcon aria-hidden="true" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Phones: the four things the desk does all day, one tap away, plus More for the rest. */
function StaffTabs({ onMore }: { onMore: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: checks } = useQuery({ queryKey: deskChecksKey, queryFn: fetchChecksCount });
  const tabs = NAV.slice(0, 4);
  return (
    <nav className="stabs" aria-label="Main">
      {tabs.map((n) => (
        <button key={n.to} type="button" aria-current={pathname === n.to ? "page" : undefined} onClick={() => navigate({ to: n.to as "/desk" })}>
          <n.icon aria-hidden="true" />
          {n.short ?? n.label}
          {n.badge && checks ? <span className="stabs__badge">{checks}</span> : null}
        </button>
      ))}
      <button type="button" onClick={onMore}>
        <Bars3Icon aria-hidden="true" />
        More
      </button>
    </nav>
  );
}

/** Top bar inside the panel: where you are, today's date, and a way back to the public site. */
function StaffTop({ me }: { me: StaffMe }) {
  const { pathname } = useLocation();
  const item = NAV.find((n) => n.to === pathname);
  const group = item?.owner ? "Owner" : "Front desk";
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Jakarta" }));
  }, []);
  return (
    <div className="staff-top">
      <nav className="staff-top__crumb" aria-label="Breadcrumb">
        <span>{group}</span>
        <span aria-hidden="true">/</span>
        <strong>{item?.label ?? "Dashboard"}</strong>
      </nav>
      <div className="staff-top__end">
        <span className="staff-top__date pds-num">{today}</span>
        <span className="staff-top__live"><i aria-hidden="true" />Live</span>
        <a className="staff-top__site" href="/" target="_blank" rel="noopener">View site</a>
        <span className="staff-top__me" aria-hidden="true">{initials(me.name)}</span>
      </div>
    </div>
  );
}

function StaffLayout() {
  const { me } = Route.useRouteContext();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="staff-shell">
      <div className="staff-side">
        <StaffNav me={me} />
      </div>
      <header className="staff-mobilebar">
        <a href="/" aria-label="Padelion, open the public site"><Logo className="brand__logo" /></a>
        <button type="button" className="staff-menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Bars3Icon aria-hidden="true" />
        </button>
      </header>
      {open ? (
        <div className="staff-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="staff-sheet__scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="staff-sheet__panel">
            <button type="button" className="staff-menu-btn staff-sheet__close" aria-label="Close menu" onClick={() => setOpen(false)}>
              <XMarkIcon aria-hidden="true" />
            </button>
            <StaffNav me={me} onPick={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="staff-content">
        <StaffTop me={me} />
        <div className="staff-page">
          <Outlet />
        </div>
      </div>
      <StaffTabs onMore={() => setOpen(true)} />
    </div>
  );
}
