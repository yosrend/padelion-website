import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/staff/StaffUI";
import { QueueListIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BanknotesIcon, CheckCircleIcon, ClockIcon, MagnifyingGlassIcon, Squares2X2Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { courtLook } from "@/lib/landing-photos";
import { Button, Card, Chip, Input, RadioCard, Slot, SlotGrid } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { CLOSE_MIN, OPEN_MIN, dayLabel, hm, idr, isoAt, jkt, todayJkt, type Busy } from "@/lib/padel";
import {
  bookingChip,
  fetchBookingDetail,
  fetchBookingsList,
  fetchCourtsAll,
  logLine,
  rpc,
  useLive,
  useNow,
  type Row,
} from "@/lib/desk-data";

export const Route = createFileRoute("/_staff/desk_/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings, Padelion front desk" },
      { name: "description", content: "Search and manage every booking at Padelion." },
      { property: "og:title", content: "Bookings, Padelion front desk" },
      { property: "og:description", content: "Search and manage every booking at Padelion." },
    ],
  }),
  component: Bookings,
});

type Filter = "all" | "balance" | "hold" | "paid";
const FILTERS: { key: Filter; label: string; icon: typeof Squares2X2Icon }[] = [
  { key: "all", label: "All", icon: Squares2X2Icon },
  { key: "balance", label: "Balance due", icon: BanknotesIcon },
  { key: "hold", label: "On hold", icon: ClockIcon },
  { key: "paid", label: "Paid", icon: CheckCircleIcon },
];

function when(b: Row) {
  const s = jkt(b.starts_at);
  return `${dayLabel(s.date)}, ${hm(s.mins)} to ${hm(jkt(b.ends_at).mins)}`;
}

function Bookings() {
  const now = useNow();
  useLive("bookings", ["bookings", "payments", "system_log"]);
  const list = useQuery({ queryKey: ["desk", "bookings"], queryFn: fetchBookingsList });
  const courts = useQuery({ queryKey: ["desk", "courts"], queryFn: fetchCourtsAll });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const courtName = (id: string) => courts.data?.find((c) => c.id === id)?.name ?? "Court";

  const sorted = useMemo(() => {
    const today = todayJkt();
    return [...(list.data ?? [])].sort((a, b) => {
      const at = jkt(a.starts_at).date === today ? 0 : 1;
      const bt = jkt(b.starts_at).date === today ? 0 : 1;
      return at - bt || a.starts_at.localeCompare(b.starts_at);
    });
  }, [list.data]);

  const kindOf = (b: Row): Filter | null => {
    const t = bookingChip(b, now).label;
    return t === "Balance due" ? "balance" : t === "On hold" ? "hold" : t === "Paid" ? "paid" : null;
  };
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, "");
  const searched = sorted.filter(
    (b) =>
      !term ||
      b.guest_name.toLowerCase().includes(term) ||
      b.code.toLowerCase().includes(term) ||
      (digits.length >= 3 && b.guest_whatsapp.replace(/\D/g, "").includes(digits)),
  );
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, f.key === "all" ? searched.length : searched.filter((b) => kindOf(b) === f.key).length]),
  ) as Record<Filter, number>;
  const rows = filter === "all" ? searched : searched.filter((b) => kindOf(b) === filter);
  const open = sorted.find((b) => b.id === openId) ?? null;

  return (
    <main className="stack-6">
      <PageHead icon={QueueListIcon} eyebrow="Front desk" title="Bookings" desc="Every booking in one list. Filter by status, open one to mark it paid, move it or cancel it." />

      <div className="bk-tools">
        <div className="search-field">
          <MagnifyingGlassIcon aria-hidden="true" className="search-field__icon" />
          <Input label="Search by name, code or WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="PDL-2048" />
        </div>
        <div className="ftabs" role="group" aria-label="Filter bookings">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={`ftabs__tab ftabs__tab--${f.key}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              <f.icon aria-hidden="true" />
              {f.label}
              <span className="ftabs__n pds-num">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {list.error ? (
        <Card surface="desk"><p className="pds-body" role="alert">Bookings didn't load. Refresh to try again.</p></Card>
      ) : list.isLoading ? (
        <div className="skel skel--timeline" aria-busy="true" />
      ) : rows.length === 0 ? (
        <Card surface="desk"><p className="pds-body">No booking matches. Try the code, like PDL-2048.</p></Card>
      ) : (
        <Card surface="desk" className="dtable">
          <div className="dtable__head pds-meta" aria-hidden="true">
            <span>Code</span><span>Player</span><span>Court</span><span>Date and time</span><span>Total</span><span>Paid</span><span>Status</span>
          </div>
          <ul className="dtable__body">
            {rows.map((b) => {
              const chip = bookingChip(b, now);
              return (
                <li key={b.id}>
                  <button type="button" className={`dtable__row${openId === b.id ? " dtable__row--on" : ""}`} onClick={() => setOpenId(b.id)}>
                    <span className="pds-label pds-num">{b.code}</span>
                    <span className="pds-body">{b.guest_name}</span>
                    <span className="pds-meta court-tag"><span className={`court-dot${courtLook({ name: courtName(b.court_id) }).center ? " court-dot--green" : ""}`} aria-hidden="true" />{courtName(b.court_id)}</span>
                    <span className="pds-meta pds-num">{when(b)}</span>
                    <span className="pds-body pds-num"><span className="dtable__k pds-meta">Total </span>{idr(b.total_idr)}</span>
                    <span className="pds-body pds-num"><span className="dtable__k pds-meta">Paid </span>{idr(b.paid_idr)}</span>
                    <span><Chip tone={chip.tone}>{chip.label}</Chip></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {open ? <DetailPanel b={open} courts={courts.data ?? []} now={now} onClose={() => setOpenId(null)} /> : null}
    </main>
  );
}

type Mode = "view" | "pay" | "move" | "cancel";

function DetailPanel({ b, courts, now, onClose }: { b: Row; courts: Row[]; now: number; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["desk", "detail", b.id], queryFn: () => fetchBookingDetail(b.id) });
  const [mode, setMode] = useState<Mode>("view");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const due = b.total_idr - b.paid_idr;
  const live = ["deposit_paid", "paid"].includes(b.status) || (b.status === "hold" && bookingChip(b, now).tone === "hold");
  const courtName = courts.find((c) => c.id === b.court_id)?.name ?? "Court";
  const chip = bookingChip(b, now);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      setMode("view");
      qc.invalidateQueries({ queryKey: ["desk"] });
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  async function resend() {
    await run(async () => {
      const { error } = await supabase.from("notifications").insert({
        booking_id: b.id,
        kind: "ticket",
        body: `Your Padelion ticket ${b.code}: ${courtName}, ${when(b)}. Show this at the desk.`,
      });
      if (error) throw new Error(error.message);
      await logLine("ticket", `Ticket resent for ${b.code}`, b.id);
    }, "Ticket sent again on WhatsApp.");
  }

  return (
    <div className="dpanel" role="dialog" aria-modal="true" aria-labelledby="dp-title">
      <button type="button" className="dpanel__scrim" aria-label="Close" onClick={onClose} />
      <aside className="dpanel__sheet stack-6">
        <div className="dpanel__top">
          <div className="stack-1">
            <p className="pds-meta pds-num">{b.code}</p>
            <h2 id="dp-title" className="pds-card-title">{b.guest_name}</h2>
            <p className="pds-meta pds-num">{b.guest_whatsapp}</p>
          </div>
          <button type="button" className="staff-menu-btn" aria-label="Close details" onClick={onClose}>
            <XMarkIcon aria-hidden="true" />
          </button>
        </div>

        <dl className="dl">
          <div><dt className="pds-meta">Court</dt><dd className="pds-body">{courtName}</dd></div>
          <div><dt className="pds-meta">Time</dt><dd className="pds-body pds-num">{when(b)}</dd></div>
          <div><dt className="pds-meta">Status</dt><dd><Chip tone={chip.tone}>{chip.label}</Chip></dd></div>
          <div><dt className="pds-meta">Total</dt><dd className="pds-body pds-num">{idr(b.total_idr)}, paid {idr(b.paid_idr)}</dd></div>
        </dl>

        <section className="stack-2">
          <h3 className="pds-label">Add-ons</h3>
          {detail.data?.addons.length ? (
            <ul className="plain-list">
              {detail.data.addons.map((a: Row, i: number) => (
                <li key={i} className="pds-body pds-num">{a.qty} x {a.addons?.name}, {idr(a.qty * a.unit_price_idr)}</li>
              ))}
            </ul>
          ) : <p className="pds-meta">No add-ons</p>}
        </section>

        <section className="stack-2">
          <h3 className="pds-label">Payments</h3>
          {detail.data?.payments.length ? (
            <ul className="plain-list">
              {detail.data.payments.map((p: Row) => (
                <li key={p.id} className="pds-body pds-num">
                  {hm(jkt(p.created_at).mins)}, {p.method.toUpperCase()}, {idr(p.amount_idr)}{p.status !== "received" ? `, ${p.status}` : ""}
                </li>
              ))}
            </ul>
          ) : <p className="pds-meta">No payments yet</p>}
        </section>

        <section className="stack-2">
          <h3 className="pds-label">Activity</h3>
          {detail.data?.log.length ? (
            <ul className="plain-list">
              {detail.data.log.map((l: Row) => (
                <li key={l.id} className="pds-meta"><span className="pds-num">{dayLabel(jkt(l.created_at).date)} {hm(jkt(l.created_at).mins)}</span>, {l.message}</li>
              ))}
            </ul>
          ) : <p className="pds-meta">Nothing logged yet</p>}
        </section>

        {mode === "pay" ? (
          <section className="stack-3" aria-label="Mark paid">
            <p className="pds-label">{b.guest_name} paid {idr(due)}</p>
            <div className="stack-2" role="radiogroup" aria-label="How they paid">
              {["cash", "qris", "transfer"].map((m) => (
                <RadioCard key={m} selected={method === m} onClick={() => setMethod(m)}>
                  {m === "cash" ? "Cash" : m === "qris" ? "Online" : "Transfer"}
                </RadioCard>
              ))}
            </div>
            <div className="row-actions">
              <Button surface="desk" variant="secondary" onClick={() => setMode("view")}>Back</Button>
              <Button surface="desk" disabled={busy} onClick={() => run(() => rpc("mark_paid", { _booking: b.id, _method: method }), "Payment saved.")}>
                Confirm payment
              </Button>
            </div>
          </section>
        ) : mode === "move" ? (
          <MovePicker b={b} courts={courts} busy={busy} onCancel={() => setMode("view")}
            onPick={(court, iso) => run(() => rpc("move_booking", { _booking: b.id, _court: court, _starts: iso }), "Booking moved. The player got a WhatsApp.")} />
        ) : mode === "cancel" ? (
          <section className="stack-3" aria-label="Cancel booking">
            <p className="pds-body">Cancel {b.code} for {b.guest_name}? The slot opens up and the waitlist gets an offer.</p>
            <div className="row-actions">
              <Button surface="desk" variant="secondary" onClick={() => setMode("view")}>Keep it</Button>
              <Button surface="desk" disabled={busy} onClick={() => run(() => rpc("cancel_booking", { _booking: b.id }), "Booking cancelled.")}>
                Yes, cancel
              </Button>
            </div>
          </section>
        ) : (
          <div className="dpanel__actions">
            {due > 0 && b.status === "deposit_paid" ? (
              <Button surface="desk" variant="primary" onClick={() => { setMethod("cash"); setMode("pay"); }}>Mark paid</Button>
            ) : null}
            {live ? <Button surface="desk" variant="secondary" onClick={() => setMode("move")}>Move</Button> : null}
            <Button surface="desk" variant="secondary" disabled={busy} onClick={resend}>Resend ticket</Button>
            {live ? <button type="button" className="text-btn pds-label" onClick={() => setMode("cancel")}>Cancel</button> : null}
          </div>
        )}
        {msg ? <p className="pds-meta" role="status">{msg}</p> : null}
      </aside>
    </div>
  );
}

function MovePicker({ b, courts, busy, onPick, onCancel }: {
  b: Row; courts: Row[]; busy: boolean; onPick: (court: string, iso: string) => void; onCancel: () => void;
}) {
  const [court, setCourt] = useState<string>(b.court_id);
  const [date, setDate] = useState(jkt(b.starts_at).date);
  const len = Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000);
  const avail = useQuery({
    queryKey: ["desk", "avail", date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_availability", { _date: date });
      if (error) throw new Error(error.message);
      return (data ?? []) as Busy[];
    },
  });
  const own = (x: Busy) => x.court_id === b.court_id && new Date(x.starts_at).getTime() === new Date(b.starts_at).getTime();
  const busyList = (avail.data ?? []).filter((x) => !own(x));
  const nowMs = Date.now();
  const starts: number[] = [];
  for (let m = OPEN_MIN; m + len <= CLOSE_MIN; m += 30) starts.push(m);
  const free = (m: number) => {
    const s = new Date(isoAt(date, m)).getTime();
    const e = s + len * 60000;
    if (s <= nowMs) return false;
    return !busyList.some((x) => x.court_id === court && new Date(x.starts_at).getTime() < e && new Date(x.ends_at).getTime() > s);
  };

  return (
    <section className="stack-3" aria-label="Move booking">
      <p className="pds-label">Move to a free slot, same length ({len} min)</p>
      <div className="seg" role="radiogroup" aria-label="Court">
        {courts.filter((c) => c.is_active).map((c) => (
          <Button key={c.id} surface="desk" variant={court === c.id ? "selection" : "secondary"} aria-pressed={court === c.id} onClick={() => setCourt(c.id)}>{c.name}</Button>
        ))}
      </div>
      <Input label="Date" type="date" value={date} min={todayJkt()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      {avail.isLoading ? <p className="pds-meta">Loading free slots</p> : (
        <SlotGrid>
          {starts.map((m) => {
            const ok = free(m);
            return <Slot key={m} time={hm(m)} state={ok ? "open" : "taken"} disabled={!ok || busy} aria-label={`Move to ${hm(m)}`} onClick={() => onPick(court, isoAt(date, m))} />;
          })}
        </SlotGrid>
      )}
      <div className="row-actions">
        <Button surface="desk" variant="secondary" onClick={onCancel}>Back</Button>
      </div>
    </section>
  );
}
