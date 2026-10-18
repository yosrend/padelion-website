import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHead, SectionHead } from "@/components/staff/StaffUI";
import { FireIcon, SparklesIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowPathIcon,
  BanknotesIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ClockIcon,
  CloudIcon,
  DocumentTextIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { Button, Card } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { dayLabel, hm, idr, jkt } from "@/lib/padel";
import { fetchCourtsAll, rpc, useLive } from "@/lib/desk-data";
import { courtLook } from "@/lib/landing-photos";
import { CountUp, DayBars, HourLines } from "@/components/staff/OwnerCharts";

export const Route = createFileRoute("/_staff/owner")({
  head: () => ({
    meta: [
      { title: "This week, Padelion owner" },
      { name: "description", content: "Owner view of bookings, revenue and court use at Padelion." },
      { property: "og:title", content: "This week, Padelion owner" },
      { property: "og:description", content: "Owner view of bookings, revenue and court use at Padelion." },
    ],
  }),
  component: Owner,
});

type Week = {
  from: string;
  to: string;
  online: number;
  total: number;
  revenue: number;
  no_shows: number;
  holds_released: number;
  capacity: number;
  court_hours: Record<string, number>;
  grid: { d: number; h: number; n: number }[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 17 }, (_, i) => 6 + i);

function Owner() {
  const { me } = Route.useRouteContext();
  if (me.role !== "owner") return <Navigate to="/desk" replace />;
  return <OwnerWeek />;
}

function OwnerWeek() {
  const qc = useQueryClient();
  useLive("owner", ["bookings", "payments", "system_log"]);
  const week = useQuery({ queryKey: ["desk", "owner-week"], queryFn: async () => (await rpc("owner_week", {})) as Week });
  const courts = useQuery({ queryKey: ["desk", "courts"], queryFn: fetchCourtsAll });
  const [reset, setReset] = useState<"idle" | "busy" | "done" | "error">("idle");
  const w = week.data;

  return (
    <main className="stack-8">
      <PageHead
        icon={ChartBarIcon}
        eyebrow={w ? `${dayLabel(w.from)} to ${dayLabel(w.to)}` : "\u00a0"}
        title="This week"
        desc="How the venue did this week, and the work the system handled so the desk did not have to."
        actions={
        <div className="stack-1">
          <Button
            surface="desk"
            variant="secondary"
            icon={ArrowPathIcon}
            disabled={reset === "busy"}
            onClick={async () => {
              setReset("busy");
              const { error } = await supabase.rpc("reset_demo" as never);
              if (error) return setReset("error");
              await qc.invalidateQueries({ queryKey: ["desk"] });
              setReset("done");
            }}
          >
            {reset === "busy" ? "Resetting" : "Reset demo data"}
          </Button>
          {reset === "done" ? <p className="pds-meta" role="status">Demo data is back on today's date.</p> : null}
          {reset === "error" ? <p className="pds-meta alert-text" role="alert">The reset didn't go through. Try again.</p> : null}
        </div>
        }
      />

      {week.error ? (
        <Card surface="desk"><p className="pds-body" role="alert">This week didn't load. Refresh to try again.</p></Card>
      ) : !w ? (
        <div className="kpi-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="skel skel--kpi" />)}</div>
      ) : (
        <>
          <section className="wk-top">
            <div className="wk-hero">
              <div className="wk-hero__glass">
              <p className="wk-hero__label"><BanknotesIcon aria-hidden="true" /> Revenue this week</p>
              <p className="wk-hero__value pds-num"><CountUp value={w.revenue} format={idr} /></p>
              <p className="wk-hero__sub">Paid and still due, across all three courts</p>
              <div className="wk-hero__split">
                <div>
                  <p className="wk-hero__k">Bookings</p>
                  <p className="wk-hero__v pds-num">{w.total}</p>
                </div>
                <div>
                  <p className="wk-hero__k">Hours played</p>
                  <p className="wk-hero__v pds-num">{Math.round(Object.values(w.court_hours).reduce((s2, h) => s2 + h, 0))}h</p>
                </div>
                <div>
                  <p className="wk-hero__k">Average per booking</p>
                  <p className="wk-hero__v pds-num">{idr(Math.round(w.revenue / Math.max(1, w.total)))}</p>
                </div>
              </div>
              </div>
            </div>
            <div className="wk-ring-card">
              <Ring pct={w.online / Math.max(1, w.total)} />
              <div className="stack-1">
                <p className="wk-ring-card__title pds-num">{w.online} of {w.total} booked without a chat</p>
                <p className="t2">Players picked a time and paid on their own. The desk did not answer a single WhatsApp for these.</p>
              </div>
            </div>
          </section>

          <div className="wk-stats">
            <Stat tone="ok" icon={ClockIcon} label="Unpaid holds released" value={String(w.holds_released)} sub="Freed for other players, no desk action" />
            <Stat tone="warn" icon={NoSymbolIcon} label="No-shows" value={String(w.no_shows)} sub="Deposit kept, court reopened" />
            <Stat tone="blue" icon={ChatBubbleLeftRightIcon} label="Chats avoided" value={String(w.online)} sub="About 5 minutes of desk time each" />
          </div>

          <section className="stack-4" aria-labelledby="trend">
            <SectionHead id="trend" icon={ChartBarIcon} title="When players book" hint="From this week's bookings" />
            <div className="wk-charts">
              <Card surface="desk"><HourLines grid={w.grid} /></Card>
              <Card surface="desk"><DayBars grid={w.grid} /></Card>
            </div>
          </section>

          <div className="wk-grid">
            <section className="stack-4" aria-labelledby="use">
              <SectionHead id="use" icon={Squares2X2Icon} title="Court use" hint={`Out of ${w.capacity} open hours each`} />
              <Card surface="desk" className="wk-courts">
                {(courts.data ?? []).map((c) => {
                  const h = Math.round(w.court_hours[String(c.sort)] ?? 0);
                  const pct = Math.min(1, h / Math.max(1, w.capacity));
                  const green = courtLook(c).center;
                  return (
                    <div key={c.id} className="wk-court">
                      <div className="wk-court__top">
                        <span className="court-tag pds-label"><span className={`court-dot${green ? " court-dot--green" : ""}`} aria-hidden="true" />{c.name}</span>
                        <span className="wk-court__pct pds-num">{Math.round(pct * 100)}%</span>
                      </div>
                      <span className="wk-bar" role="img" aria-label={`${c.name}, ${h} of ${w.capacity} hours`}>
                        <span className={`wk-bar__fill${green ? " wk-bar__fill--green" : ""}`} style={{ width: `${pct * 100}%` }} />
                      </span>
                      <p className="pds-meta pds-num">{h} of {w.capacity} hours booked</p>
                    </div>
                  );
                })}
              </Card>
            </section>

            <section className="stack-4" aria-labelledby="busy">
              <SectionHead id="busy" icon={FireIcon} title="Busiest hours" hint="Bookings per hour, Mon to Sun" />
              <Heatmap grid={w.grid} />
            </section>
          </div>

          <section className="stack-4" aria-labelledby="sys">
            <SectionHead id="sys" icon={SparklesIcon} title="What the system did for you" hint="Work nobody at the desk had to do" />
            <SystemLog />
          </section>
        </>
      )}
    </main>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="wk-ring" viewBox="0 0 84 84" role="img" aria-label={`${Math.round(pct * 100)} percent`}>
      <defs>
        <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d4ff3a" />
          <stop offset="0.55" stopColor="#84cc16" />
          <stop offset="1" stopColor="#3f9a12" />
        </linearGradient>
      </defs>
      <circle cx="42" cy="42" r={r} className="wk-ring__track" />
      <circle cx="42" cy="42" r={r} className="wk-ring__fill" stroke="url(#ring-g)" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ ["--ring-c" as string]: String(c) }} />
      <text x="42" y="47" textAnchor="middle" className="wk-ring__text">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

function Stat({ tone, icon: I, label, value, sub }: { tone: "ok" | "warn" | "blue"; icon: typeof ClockIcon; label: string; value: string; sub: string }) {
  return (
    <div className={`wk-stat wk-stat--${tone}`}>
      <span className="wk-stat__icon" aria-hidden="true"><I /></span>
      <div className="wk-stat__text">
        <p className="wk-stat__label">{label}</p>
        <p className="wk-stat__value pds-num">{value}</p>
        <p className="wk-stat__sub">{sub}</p>
      </div>
    </div>
  );
}

function Heatmap({ grid }: { grid: Week["grid"] }) {
  const max = Math.max(1, ...grid.map((g) => g.n));
  const at = (d: number, h: number) => grid.find((g) => g.d === d && g.h === h)?.n ?? 0;
  // Busiest 3 hour window, weekdays and weekends counted apart.
  const win = (days: number[]) => {
    let best = { h: 6, v: -1 };
    for (let h = 6; h <= 20; h++) {
      const v = days.reduce((s, d) => s + at(d, h) + at(d, h + 1) + at(d, h + 2), 0) / days.length;
      if (v > best.v) best = { h, v };
    }
    return best;
  };
  const wd = win([1, 2, 3, 4, 5]);
  const we = win([6, 7]);
  const peak = wd.v >= we.v ? { label: "Weekdays", ...wd, days: [1, 2, 3, 4, 5] } : { label: "Weekends", ...we, days: [6, 7] };

  return (
    <Card surface="desk" className="stack-4 wk-heat">
      <p className="wk-peak"><FireIcon aria-hidden="true" /> Peak: {peak.label.toLowerCase()}, {hm(peak.h * 60)} to {hm((peak.h + 3) * 60)}</p>
      <div className="heat-scroll">
        <table className="heat">
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Day</span></th>
              {HOURS.map((h) => <th key={h} scope="col" className="pds-meta pds-num">{String(h).padStart(2, "0")}</th>)}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d, di) => (
              <tr key={d}>
                <th scope="row" className="pds-meta">{d}</th>
                {HOURS.map((h) => {
                  const n = at(di + 1, h);
                  const inPeak = peak.days.includes(di + 1) && h >= peak.h && h < peak.h + 3;
                  return (
                    <td key={h}>
                      <span
                        className={`heat__cell${inPeak ? " heat__cell--peak" : ""}`}
                        style={{ ["--lvl" as string]: String(n / max) }}
                        title={`${d} ${hm(h * 60)}, ${n} bookings`}
                        aria-label={`${d} ${hm(h * 60)}, ${n} bookings`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="wk-legend" aria-hidden="true">
        <span>Quiet</span>
        {[0.1, 0.35, 0.6, 0.85, 1].map((l) => <span key={l} className="heat__cell" style={{ ["--lvl" as string]: String(l) }} />)}
        <span>Full</span>
      </div>
    </Card>
  );
}

const ICON: Record<string, typeof ClockIcon> = {
  hold: ClockIcon,
  hold_released: ClockIcon,
  waitlist: BellIcon,
  payment: BanknotesIcon,
  rain: CloudIcon,
  checkin: CheckBadgeIcon,
};

function SystemLog() {
  const [limit, setLimit] = useState(8);
  const log = useQuery({
    queryKey: ["desk", "syslog", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_log").select("id,kind,message,created_at").order("created_at", { ascending: false }).limit(limit + 1);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
  const rows = (log.data ?? []).slice(0, limit);
  const more = (log.data?.length ?? 0) > limit;
  return (
    <Card surface="desk" className="needs">
      {rows.length === 0 ? <p className="pds-body log-row">Nothing yet.</p> : rows.map((l) => {
        const Icon = ICON[l.kind] ?? DocumentTextIcon;
        const t = jkt(l.created_at);
        return (
          <div key={l.id} className={`log-row log-row--${l.kind}`}>
            <span className="log-row__tile" aria-hidden="true"><Icon /></span>
            <span className="pds-body">{l.message}</span>
            <span className="pds-meta pds-num log-row__time">{dayLabel(t.date)}, {hm(t.mins)}</span>
          </div>
        );
      })}
      {more ? (
        <div className="log-row log-row--more">
          <Button surface="desk" variant="secondary" onClick={() => setLimit((n) => n + 8)}>Show more</Button>
        </div>
      ) : null}
    </Card>
  );
}
