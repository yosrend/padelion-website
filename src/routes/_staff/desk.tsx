import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BanknotesIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  CloudIcon,
  HomeIcon,
  SignalIcon,
  UsersIcon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { Chip } from "@/design-system/padelion";
import { Empty, PageHead, SectionHead } from "@/components/staff/StaffUI";
import { courtLook } from "@/lib/landing-photos";
import { Button, Card, KpiCard, RadioCard, Timeline, type TimelineRow } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { hm, idr } from "@/lib/padel";
import {
  countdown,
  deskChecksKey,
  deskTodayKey,
  fetchDeskToday,
  isActive,
  minsOf,
  shortDate,
  type DeskBooking,
  type DeskToday,
} from "@/lib/desk";

export const Route = createFileRoute("/_staff/desk")({
  head: () => ({
    meta: [
      { title: "Today, Padelion front desk" },
      { name: "description", content: "Front desk view of tonight's courts at Padelion." },
      { property: "og:title", content: "Today, Padelion front desk" },
      { property: "og:description", content: "Front desk view of tonight's courts at Padelion." },
    ],
  }),
  component: Desk,
});

const TL_START = 16 * 60;
const TL_END = 23 * 60;
const TL_SPAN = TL_END - TL_START;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Desk() {
  const qc = useQueryClient();
  const now = useNow();
  const { data, isLoading, error } = useQuery({ queryKey: deskTodayKey, queryFn: fetchDeskToday, refetchInterval: 60_000 });
  const [rain, setRain] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel("desk-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        qc.invalidateQueries({ queryKey: deskTodayKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: deskTodayKey });
        qc.invalidateQueries({ queryKey: deskChecksKey });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <main className="stack-8">
      <PageHead
        icon={HomeIcon}
        eyebrow={data ? shortDate(data.date) : "\u00a0"}
        title="Today"
        desc="Who is on court now, who is next, and what needs you before they play."
        actions={
          <button type="button" role="switch" aria-checked={rain} className="rain-switch" onClick={() => setRain((r) => !r)}>
            <CloudIcon aria-hidden="true" className="rain-switch__icon" />
            <span className="pds-label">Weather alert</span>
            <span className="rain-switch__track" aria-hidden="true">
              <span className="rain-switch__knob" />
            </span>
          </button>
        }
      />

      {error ? (
        <Card surface="desk"><p className="pds-body" role="alert">Today's courts didn't load. Refresh the page to try again.</p></Card>
      ) : isLoading || !data ? (
        <DeskSkeleton />
      ) : (
        <>
          <Kpis data={data} now={now} />
          {rain ? <RainPanel data={data} now={now} /> : null}
          <section className="stack-4" aria-labelledby="live">
            <SectionHead id="live" icon={SignalIcon} title="On court now" hint="Live, updates on its own" />
            <LiveBoard data={data} now={now} />
          </section>
          <section className="stack-4" aria-labelledby="needs">
            <SectionHead id="needs" icon={BellAlertIcon} title="Needs you before play" hint="Balances still due, soonest first" />
            <NeedsYou data={data} now={now} />
          </section>
          <section className="stack-4" aria-labelledby="tonight">
            <SectionHead id="tonight" icon={ViewColumnsIcon} title="Tonight at a glance" hint="16.00 to 23.00, the line is now" />
            <Tonight data={data} now={now} />
          </section>
        </>
      )}
    </main>
  );
}

function chipFor(b: DeskBooking) {
  if (b.status === "hold") return <Chip tone="hold">On hold</Chip>;
  if (b.total_idr > b.paid_idr) return <Chip tone="balance">Balance due</Chip>;
  return <Chip tone="paid">Paid</Chip>;
}

/** One card per court: the game on it right now, and the next one. Answers "who is playing?" at a glance. */
function LiveBoard({ data, now }: { data: DeskToday; now: number }) {
  return (
    <div className="live">
      {data.courts.map((c) => {
        const look = courtLook(c);
        const mine = data.bookings
          .filter((b) => b.court_id === c.id && isActive(b, now))
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        const cur = mine.find((b) => new Date(b.starts_at).getTime() <= now && new Date(b.ends_at).getTime() > now);
        const next = mine.find((b) => new Date(b.starts_at).getTime() > now);
        const range = (b: DeskBooking) => `${hm(minsOf(b.starts_at))} to ${hm(minsOf(b.ends_at))}`;
        return (
          <article key={c.id} className={`live-court${look.center ? " live-court--green" : ""}`}>
            <div className="live-court__head">
              <span className="live-court__swatch" aria-hidden="true" />
              <p className="live-court__name">{c.name}</p>
              <p className="live-court__kind">{look.center ? "Center, green" : "Blue"}</p>
            </div>
            <div className="live-slot live-slot--now">
              <p className="live-slot__tag">Now</p>
              {cur ? (
                <div>
                  <p className="live-slot__who">{cur.status === "hold" ? "Guest hold" : cur.guest_name}</p>
                  <p className="live-slot__when pds-num">{range(cur)}</p>
                  {chipFor(cur)}
                </div>
              ) : (
                <p className="live-slot__free">Free{next ? ` until ${hm(minsOf(next.starts_at))}` : " for the rest of today"}</p>
              )}
            </div>
            <div className="live-slot">
              <p className="live-slot__tag">Next</p>
              {next ? (
                <div>
                  <p className="live-slot__who">{next.status === "hold" ? "Guest hold" : next.guest_name}</p>
                  <p className="live-slot__when pds-num">{range(next)}</p>
                  {chipFor(next)}
                </div>
              ) : (
                <p className="live-slot__free">Nothing else booked today</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DeskSkeleton() {
  return (
    <div className="stack-8" aria-busy="true" aria-label="Loading today">
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel skel--kpi" />)}
      </div>
      <div className="skel skel--timeline" />
      <div className="skel skel--row" />
      <div className="skel skel--row" />
    </div>
  );
}

function Kpis({ data, now }: { data: DeskToday; now: number }) {
  const courtName = (id: string) => data.courts.find((c) => c.id === id)?.name ?? "Court";
  const active = data.bookings.filter((b) => isActive(b, now));
  const games = active.filter((b) => b.status !== "hold" && minsOf(b.starts_at) >= 17 * 60).length;
  const due = active.filter((b) => b.status === "deposit_paid" && b.total_idr > b.paid_idr);
  const dueSum = due.reduce((s, b) => s + b.total_idr - b.paid_idr, 0);
  const holds = active.filter((b) => b.status === "hold");
  const h = holds[0];
  return (
    <div className="kpi-grid">
      <KpiCard icon={CalendarDaysIcon} label="Games tonight" value={String(games)} sub="From 17.00" />
      <KpiCard icon={BanknotesIcon} label="Balance still due" value={idr(dueSum)} sub={`${due.length} ${due.length === 1 ? "booking" : "bookings"}`} />
      <KpiCard
        icon={ClockIcon}
        label="Holds running"
        value={String(holds.length)}
        sub={h ? `${courtName(h.court_id)}, ${hm(minsOf(h.starts_at))}, ends ${hm(minsOf(h.hold_expires_at!))}` : "No guest is holding a court"}
      />
      <KpiCard icon={UsersIcon} label="Waitlist offers" value={String(data.offers)} sub="Waiting for a reply" />
    </div>
  );
}

function Tonight({ data, now }: { data: DeskToday; now: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const placed = useMemo(
    () =>
      data.courts.map((c) => {
        const items = data.bookings
          .filter((b) => b.court_id === c.id && isActive(b, now))
          .map((b) => {
            const s = Math.max(minsOf(b.starts_at), TL_START);
            const e = Math.min(minsOf(b.ends_at) || 24 * 60, TL_END);
            return { b, s, e };
          })
          .filter((x) => x.e > x.s);
        return { court: c.name, items };
      }),
    [data, Math.floor(now / 60_000)],
  );

  const rows: TimelineRow[] = placed.map((r) => ({
    court: r.court,
    blocks: r.items.map(({ b }) => ({
      label: b.status === "hold"
        ? `Hold, ${hm(minsOf(b.starts_at))}`
        : `${b.guest_name}, ${hm(minsOf(b.starts_at))}`,
      state: b.status === "hold" ? "hold" : b.status === "deposit_paid" ? "balance" : "paid",
    })),
  }));

  // Place each block on the 16.00 to 23.00 axis. Position only, the block keeps its own look.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>(".pds-timeline__row").forEach((row, ri) => {
      row.querySelectorAll<HTMLElement>(".pds-timeline__block").forEach((blk, bi) => {
        const it = placed[ri]?.items[bi];
        if (!it) return;
        blk.style.left = `${((it.s - TL_START) / TL_SPAN) * 100}%`;
        blk.style.width = `${((it.e - it.s) / TL_SPAN) * 100}%`;
        blk.title = `${it.b.guest_name}, ${hm(minsOf(it.b.starts_at))} to ${hm(minsOf(it.b.ends_at))}`;
      });
    });
  });

  const nowMins = minsOf(new Date(now).toISOString());
  const showLine = nowMins >= TL_START && nowMins <= TL_END;
  const hours = Array.from({ length: 8 }, (_, i) => TL_START + i * 60);

  return (
    <div className="tl-scroll">
      <div className="tl" ref={ref}>
        <div className="tl-axis" aria-hidden="true">
          <span />
          <div className="tl-axis__track">
            {hours.map((m) => (
              <span key={m} className="pds-meta pds-num tl-axis__tick" style={{ left: `${((m - TL_START) / TL_SPAN) * 100}%` }}>{hm(m)}</span>
            ))}
          </div>
        </div>
        <div className="tl-body">
          <Timeline rows={rows} />
          {showLine ? (
            <div className="tl-now" style={{ ["--tl-pos" as string]: String((nowMins - TL_START) / TL_SPAN) }} aria-label={`Now, ${hm(nowMins)}`} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Method = "cash" | "qris" | "transfer";

function NeedsYou({ data, now }: { data: DeskToday; now: number }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<DeskBooking | null>(null);
  const [method, setMethod] = useState<Method>("cash");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);
  const courtName = (id: string) => data.courts.find((c) => c.id === id)?.name ?? "Court";

  const rows = data.bookings
    .filter((b) => b.status === "deposit_paid" && b.total_idr > b.paid_idr && b.balance_due_at)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  if (rows.length === 0) {
    return <Card surface="desk"><Empty icon={CheckBadgeIcon} title="All settled" desc="Every game today is paid. Nothing needs you right now." /></Card>;
  }

  async function confirm() {
    if (!target) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("mark_paid" as never, { _booking: target.id, _method: method } as never);
    setBusy(false);
    if (error) return setErr(error.message);
    const id = target.id;
    setTarget(null);
    setLeaving((l) => [...l, id]);
    setTimeout(() => qc.invalidateQueries({ queryKey: deskTodayKey }), 200);
  }

  return (
    <>
      <Card surface="desk" className="needs">
        {rows.map((b, i) => (
          <div key={b.id} className={`needs-row${leaving.includes(b.id) ? " needs-row--leaving" : ""}`}>
            <span className="needs-row__icon" aria-hidden="true"><BanknotesIcon /></span>
            <div className="stack-1">
              <p className="pds-meta">{courtName(b.court_id)}, {hm(minsOf(b.starts_at))}</p>
              <p className="pds-label">{b.guest_name}</p>
              <p className="pds-meta pds-num"><ClockIcon className="inline-ico" aria-hidden="true" /> {countdown(new Date(b.balance_due_at!).getTime() - now)}</p>
            </div>
            <p className="pds-card-title pds-num">{idr(b.total_idr - b.paid_idr)}</p>
            <Button
              surface="desk"
              variant={i === 0 ? "primary" : "secondary"}
              onClick={() => { setMethod("cash"); setErr(null); setTarget(b); }}
            >
              Mark paid
            </Button>
          </div>
        ))}
      </Card>

      {target ? (
        <div className="desk-modal" role="dialog" aria-modal="true" aria-labelledby="mp-title">
          <button type="button" className="desk-modal__scrim" aria-label="Cancel" onClick={() => setTarget(null)} />
          <Card surface="desk" className="desk-modal__card stack-4">
            <div className="stack-1">
              <p className="pds-meta">{courtName(target.court_id)}, {hm(minsOf(target.starts_at))}</p>
              <p id="mp-title" className="pds-card-title">{target.guest_name} paid {idr(target.total_idr - target.paid_idr)}</p>
            </div>
            <div className="stack-2" role="radiogroup" aria-label="How they paid">
              {(["cash", "qris", "transfer"] as Method[]).map((m) => (
                <RadioCard key={m} selected={method === m} onClick={() => setMethod(m)}>
                  {m === "cash" ? "Cash" : m === "qris" ? "Online" : "Transfer"}
                </RadioCard>
              ))}
            </div>
            {err ? <p className="pds-meta alert-text" role="alert">{err}</p> : null}
            <div className="desk-modal__actions">
              <Button surface="desk" variant="secondary" onClick={() => setTarget(null)}>Cancel</Button>
              <Button surface="desk" disabled={busy} onClick={confirm}>{busy ? "Saving" : "Confirm payment"}</Button>
            </div>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function RainPanel({ data, now }: { data: DeskToday; now: number }) {
  const [sent, setSent] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const court3 = data.courts.find((c) => c.sort === 3) ?? data.courts.find((c) => !/indoor/i.test(c.kind));
  const indoor = data.courts.filter((c) => /indoor/i.test(c.kind));

  const affected = data.bookings
    .filter((b) => court3 && b.court_id === court3.id && isActive(b, now) && b.status !== "hold" && new Date(b.ends_at).getTime() > now)
    .map((b) => {
      const s = new Date(b.starts_at).getTime();
      const e = new Date(b.ends_at).getTime();
      const free = indoor.find((c) =>
        !data.bookings.some((o) => o.court_id === c.id && isActive(o, now) && new Date(o.starts_at).getTime() < e && new Date(o.ends_at).getTime() > s) &&
        !data.blocks.some((k) => k.court_id === c.id && new Date(k.starts_at).getTime() < e && new Date(k.ends_at).getTime() > s),
      );
      const time = hm(minsOf(b.starts_at));
      return { b, text: free ? `${free.name}, ${time} is free` : "No indoor court free, offer a new time" };
    });

  async function send() {
    setBusy(true);
    const rowsN = affected.map(({ b, text }) => ({
      booking_id: b.id,
      kind: "rain_options",
      body: `Rain on ${court3?.name}. Your game at ${hm(minsOf(b.starts_at))}: ${text}. Reply to switch, or keep your slot.`,
    }));
    const { error } = await supabase.from("notifications").insert(rowsN);
    if (!error) {
      await supabase.from("system_log").insert({ kind: "rain", message: `Rain options sent to ${rowsN.length} players, ${court3?.name}` });
      setSent(rowsN.length);
    }
    setBusy(false);
  }

  return (
    <Card surface="desk" className="stack-4 rain-panel">
      <div className="stack-1">
        <p className="pds-meta">Rain mode</p>
        <h2 className="pds-card-title">{court3?.name} from now until 23.00</h2>
      </div>
      {affected.length === 0 ? (
        <p className="pds-body">No games left on {court3?.name} today.</p>
      ) : (
        <ul className="rain-list">
          {affected.map(({ b, text }) => (
            <li key={b.id} className="rain-row">
              <div className="stack-1">
                <p className="pds-meta">{hm(minsOf(b.starts_at))} to {hm(minsOf(b.ends_at))}</p>
                <p className="pds-label">{b.guest_name}</p>
              </div>
              <p className="pds-body">{text}</p>
            </li>
          ))}
        </ul>
      )}
      {affected.length > 0 ? (
        <div className="rain-actions">
          <Button surface="desk" variant="secondary" disabled={busy || sent !== null} onClick={send}>Send options</Button>
          {sent !== null ? <p className="pds-meta" role="status">Options sent to {sent} {sent === 1 ? "player" : "players"}</p> : null}
        </div>
      ) : null}
    </Card>
  );
}

