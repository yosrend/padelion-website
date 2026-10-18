import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckinPass } from "@/components/player/CheckinPass";
import { PadelTicket } from "@/components/player/PadelTicket";
import { TicketImageBar } from "@/components/player/TicketImage";
import { PhoneField } from "@/components/player/PhoneField";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Input, RadioCard, TicketCard } from "@/design-system/padelion";
import { FlowSteps, SiteFooter, TopBar } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { ArrowPathIcon, CalendarDaysIcon, ShareIcon } from "@heroicons/react/24/outline";
import { dayLabel, idr, jkt, recallWa, rememberWa, statusCopy, timeLabel, type BookingView } from "@/lib/padel";

import { normalizeWa, rules, useFieldErrors } from "@/lib/validate";
import { useCurrency, useMoney } from "@/lib/currency";
import { PAY_LABEL, PayMethods, type PayMethod } from "@/components/player/PayMethods";
import { courtLook } from "@/lib/landing-photos";
export const Route = createFileRoute("/booking/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Booking ${params.code} at Padelion` },
      { name: "description", content: "Your Padelion booking: pay your deposit and show your ticket at the desk." },
      { property: "og:title", content: `Booking ${params.code} at Padelion` },
      { property: "og:description", content: "Your Padelion booking: pay your deposit and show your ticket at the desk." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { moved?: string } => ({
    moved: typeof s.moved === "string" ? s.moved.slice(0, 60) : undefined,
  }),
  component: BookingPage,
});

function BookingPage() {
  const { code } = Route.useParams();
  const [wa, setWa] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setWa(recallWa(code));
    setReady(true);
  }, [code]);

  return (
    <>
      <TopBar />
      <main className="wrap page-pad">
        {!ready ? null : wa ? (
          <BookingView code={code} wa={wa} onReset={() => setWa(null)} />
        ) : (
          <WaGate code={code} onSubmit={(v) => { rememberWa(code, v); setWa(v); }} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function WaGate({ code, onSubmit }: { code: string; onSubmit: (wa: string) => void }) {
  const [v, setV] = useState("");
  const form = useFieldErrors({ wa: () => rules.wa(v) });
  return (
    <form className="stack-6" style={{ maxWidth: "calc(var(--space-13) * 4)" }} onSubmit={(e) => { e.preventDefault(); if (form.check({ wa: "gate-wa" })) onSubmit(normalizeWa(v) ?? v); }}>
      <div className="stack-3">
        <p className="meta pds-num">{code}</p>
        <h1 className="pds-section-title">Confirm it is your booking</h1>
        <p className="body-lg">Enter the WhatsApp number you booked with.</p>
      </div>
      <PhoneField id="gate-wa" value={v} onChange={setV} error={form.error("wa")} {...form.blur("wa")} />
      <div><Button type="submit">Show my booking</Button></div>
    </form>
  );
}

function useCountdown(to: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!to) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [to]);
  if (!to) return null;
  const left = Math.max(0, new Date(to).getTime() - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, label: `${m}.${String(s).padStart(2, "0")}` };
}

function BookingView({ code, wa, onReset }: { code: string; wa: string; onReset: () => void }) {
  const q = useQuery({
    queryKey: ["booking", code, wa],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking", { _code: code, _wa: wa });
      if (error) throw error;
      return data as unknown as BookingView | null;
    },
  });

  const navigate = useNavigate();
  const expired = q.data?.status === "expired";
  useEffect(() => {
    if (expired) navigate({ to: "/hold-expired/$code", params: { code }, replace: true });
  }, [expired, code, navigate]);

  if (q.isLoading || expired) return <p className="t2">Loading your booking</p>;
  if (q.error) return <p className="notice notice--error" role="alert">We could not load your booking. Refresh to try again.</p>;
  if (!q.data)
    return (
      <div className="stack-4">
        <h1 className="pds-section-title">We could not find that booking</h1>
        <p className="body-lg">Check the code and the WhatsApp number you booked with.</p>
        <div className="row">
          <button type="button" className="textlink" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit" }} onClick={onReset}>
            Try another number
          </button>
          <Link to="/find" className="textlink">Find my booking</Link>
        </div>
      </div>
    );

  return q.data.status === "hold" ? <PayScreen b={q.data} wa={wa} /> : <Ticket b={q.data} wa={wa} />;
}

function PayScreen({ b, wa }: { b: BookingView; wa: string }) {
  const money = useMoney();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"deposit" | "full">("deposit");
  const [method, setMethod] = useState<PayMethod>("apple");
  const st = useQuery(settingsQuery);
  const pct = st.data?.deposit_pct ?? 50;
  const cur = useCurrency();
  const [err, setErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const cd = useCountdown(b.hold_expires_at);
  const amount = mode === "full" ? b.total_idr : Math.floor((b.total_idr * pct) / 100);
  const expired = cd?.left === 0;
  useEffect(() => {
    if (expired) navigate({ to: "/hold-expired/$code", params: { code: b.code }, replace: true });
  }, [expired, b.code, navigate]);

  const backToTime = () => {
    const t = jkt(b.starts_at);
    navigate({ to: "/book", search: { court: b.court_id, date: t.date, start: t.mins, minutes: b.minutes, review: b.code } });
  };

  async function pay() {
    setErr(null);
    setPaying(true);
    const { data, error } = await supabase.rpc("pay_booking", { _code: b.code, _wa: wa, _mode: mode });
    setPaying(false);
    if (error) {
      setErr(error.message);
      return;
    }
    try { sessionStorage.setItem(`padelion.paid.${b.code}`, "1"); } catch { /* ignore */ }
    qc.setQueryData(["booking", b.code, wa], data);
  }

  return (
    <div className="flow" style={{ paddingTop: 0 }}>
      <div className="stack-8">
        <div className="book-head">
          <div className="stack-3">
            <div className="row">
              <Chip tone="hold">On hold</Chip>
              <span className="meta pds-num">{b.code}</span>
            </div>
            <h1 className="pds-page-display">
              Held for you, <span className="pds-num">{cd?.label ?? "15.00"}</span> left
            </h1>
            <p className="body-lg">Pay before the timer ends and the court is yours. If it runs out, the time opens up for the next player.</p>
          </div>
          <FlowSteps current={1} onStep={backToTime} />
        </div>

        <div className="held-note" role="status">
          <span className="held-note__tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="held-note__t pds-num">{b.court} is held for you</p>
            <p className="t2 pds-num">{dayLabel(jkt(b.starts_at).date)}, {timeLabel(b.starts_at)} to {timeLabel(b.ends_at)}. Nobody else can take it while the timer runs.</p>
          </div>
          <button type="button" className="held-note__edit" onClick={backToTime}>Change time or court</button>
        </div>

        <section className="block" aria-labelledby="amt-h">
          <div className="block__head">
            <h2 id="amt-h" className="pds-card-title">How much do you want to pay now?</h2>
          </div>
          <div className="court-grid" role="radiogroup" aria-labelledby="amt-h" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(calc(var(--space-13) * 2), 1fr))" }}>
            <RadioCard selected={mode === "deposit"} onClick={() => setMode("deposit")}>
              <span className="stack-2">
                <span className="meta">Deposit, {pct}%</span>
                <span className="pds-card-title pds-num">{money(Math.floor((b.total_idr * pct) / 100))}</span>
                <span className="t2">Balance due {st.data?.balance_hours ?? 2} hours before you play</span>
              </span>
            </RadioCard>
            <RadioCard selected={mode === "full"} onClick={() => setMode("full")}>
              <span className="stack-2">
                <span className="meta">Pay in full</span>
                <span className="pds-card-title pds-num">{money(b.total_idr)}</span>
                <span className="t2">Nothing left to pay at the desk</span>
              </span>
            </RadioCard>
          </div>
        </section>

        <section className="block" aria-labelledby="pm-h">
          <div className="block__head">
            <h2 id="pm-h" className="pds-card-title">How do you want to pay?</h2>
          </div>
          <PayMethods value={method} onChange={setMethod} />
          {cur === "USD" ? <p className="t2 pds-num">Charged in rupiah: {idr(amount)}.</p> : null}
        </section>

        <section className="block" aria-labelledby="next-h">
          <div className="block__head">
            <h2 id="next-h" className="pds-card-title">What happens after you pay</h2>
          </div>
          <ol className="paynext">
            <li><span className="paynext__n pds-num">1</span><span><strong>Your ticket opens here</strong><span className="t2">With a QR for the desk and the code {b.code}.</span></span></li>
            <li><span className="paynext__n pds-num">2</span><span><strong>A copy lands on WhatsApp</strong><span className="t2 pds-num">Sent to {wa}, with a reminder before you play.</span></span></li>
            <li><span className="paynext__n pds-num">3</span><span><strong>Walk in and play</strong><span className="t2 pds-num">{mode === "full" ? "Nothing left to pay at the desk." : `The balance is due ${st.data?.balance_hours ?? 2} hours before, online or at the desk.`} Free to move up to {st.data?.reschedule_hours ?? 12} hours ahead.</span></span></li>
          </ol>
        </section>
      </div>

      <aside className="flow__aside">
        <Card surface="public" className="sum-card">
          <img className="sum-card__photo" src={courtLook({ name: b.court }).photo.src} alt={`${b.court} at Padelion`} loading="lazy" />
          <p className="meta">{courtLook({ name: b.court }).label}</p>
          <div className="stack-2">
            <p className="sum-card__title">{b.court}</p>
            <p className="sum-card__line pds-num">{dayLabel(jkt(b.starts_at).date)}, {timeLabel(b.starts_at)} to {timeLabel(b.ends_at)}</p>
          </div>
          <hr className="divider" />
          <div className="stack-2">
            <div className="sum-line"><span className="t2">Court</span><span className="pds-num">{money(b.subtotal_idr)}</span></div>
            {b.addons.map((a) => (
              <div className="sum-line" key={a.name}><span className="t2">{a.qty} × {a.name}</span><span className="pds-num">{money(a.qty * a.unit_price_idr)}</span></div>
            ))}
            <div className="sum-line sum-line--total"><span>Total</span><span className="pds-num">{money(b.total_idr)}</span></div>
          </div>
          <details className="sum-more" open>
            <summary>Your details</summary>
            <dl className="sum-more__list">
              <div><dt>Name</dt><dd>{b.guest_name}</dd></div>
              <div><dt>WhatsApp</dt><dd className="pds-num">{wa}</dd></div>
              <div><dt>Length</dt><dd className="pds-num">{b.minutes} minutes</dd></div>
              {b.note ? <div><dt>Your request</dt><dd>{b.note}</dd></div> : null}
            </dl>
            <button type="button" className="textbtn" onClick={backToTime}>Change time, court or extras</button>
          </details>
          {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
          {expired ? (
            <>
              <p className="notice notice--error" role="alert">Your hold has ended. The time is open again.</p>
              <Button className="full" onClick={() => navigate({ to: "/book" })}>Book again</Button>
            </>
          ) : (
            <Button className="full sum-card__cta" disabled={paying} onClick={pay}>
              {paying ? "Confirming payment" : `Pay ${money(amount)} with ${PAY_LABEL[method]}`}
            </Button>
          )}
        </Card>
      </aside>
    </div>
  );
}

function icsFor(b: BookingView) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Padelion//Booking//EN", "BEGIN:VEVENT",
    `UID:${b.code}@padelion`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(b.starts_at)}`, `DTEND:${f(b.ends_at)}`,
    `SUMMARY:Padel at Padelion, ${b.court}`, "LOCATION:Padelion\\, Jl. Kemang Raya\\, Jakarta",
    `DESCRIPTION:Booking ${b.code}. Show your ticket at the desk.`, "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

function Ticket({ b, wa }: { b: BookingView; wa: string }) {
  const money = useMoney();
  const qc = useQueryClient();
  const { moved } = Route.useSearch();
  const rh = useQuery(settingsQuery).data?.reschedule_hours ?? 12;
  const balance = Math.max(0, b.total_idr - b.paid_idr);
  const credit = Math.max(0, b.paid_idr - b.total_idr);
  const ended = b.status === "expired" || b.status === "cancelled" || b.status === "played" || b.status === "no_show";
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PayMethod>("apple");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  // Straight after paying: a short burst of confetti in the venue colours, once.
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    let paid = false;
    try { paid = sessionStorage.getItem(`padelion.paid.${b.code}`) === "1"; sessionStorage.removeItem(`padelion.paid.${b.code}`); } catch { /* ignore */ }
    if (!paid) return;
    setCelebrate(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    import("canvas-confetti").then(({ default: confetti }) => {
      const colors = ["#d4ff3a", "#2d4e9c", "#ffffff", "#3a261c"];
      confetti({ particleCount: 90, spread: 70, startVelocity: 42, origin: { x: 0.25, y: 0.35 }, colors, scalar: 0.9, disableForReducedMotion: true });
      setTimeout(() => confetti({ particleCount: 70, spread: 90, startVelocity: 36, origin: { x: 0.7, y: 0.3 }, colors, scalar: 0.9, disableForReducedMotion: true }), 220);
    });
  }, [b.code]);
  const moveClosed = now != null && now > new Date(b.starts_at).getTime() - rh * 3600000;

  async function payBalance() {
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("pay_balance", { _code: b.code, _wa: wa });
    setBusy(false);
    if (error) return setErr(error.message);
    qc.setQueryData(["booking", b.code, wa], data);
    setPaying(false);
  }

  async function share() {
    const url = window.location.origin + window.location.pathname;
    const text = `Padel at Padelion: ${b.court}, ${dayLabel(jkt(b.starts_at).date)}, ${timeLabel(b.starts_at)} to ${timeLabel(b.ends_at)}.`;
    try {
      if (navigator.share) { await navigator.share({ title: "Our padel game", text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote("Link copied. Paste it in your group chat.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Could not share. Copy the address from your browser bar.");
    }
  }

  function calendar() {
    const blob = new Blob([icsFor(b)], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `padelion-${b.code}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="tpage">
      <div className="tpage__head">
        {!ended ? <FlowSteps current={2} /> : null}
        {moved && !ended ? <p className="hold-box pds-num" role="status">Moved to {moved}</p> : null}
        <div className="tpage__hello">
          {!ended ? (
            <span className={`tpage__tick${celebrate ? " tpage__tick--big" : ""}`} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          ) : null}
          <div className="stack-2">
          <p className="meta pds-num">{celebrate ? "Payment received" : b.code}</p>
          <h1 className="pds-page-display">
            {ended ? "This booking is no longer active." : `See you on court, ${b.guest_name.split(" ")[0]}.`}
          </h1>
          <p className="body-lg">
            {b.status === "cancelled"
              ? "This booking was cancelled."
              : b.status === "played" || b.status === "no_show"
                ? "This game is in the past."
                : ended
                  ? "The hold ended before payment. The time went back to other players."
                  : "Your ticket is on its way to your WhatsApp. Show it at the desk when you arrive."}
          </p>
          </div>
        </div>
      </div>
      <PadelTicket b={b} wa={wa} money={money} balance={balance} live={!ended}
        status={ended ? statusCopy(b.status) : balance > 0 ? "Deposit paid, balance due" : statusCopy(b.status)} />
      {!ended ? <TicketImageBar b={b} wa={wa} money={money} balance={balance} status={balance > 0 ? "Deposit paid, balance due" : statusCopy(b.status)} /> : null}
      <div className="tpage__actions">
        {balance > 0 && !ended ? (
          <div className="tact tact--due">
            <div><Chip tone="balance">Balance due</Chip></div>
            <p className="pds-card-title pds-num">{money(balance)}</p>
            {b.balance_due_at ? <p className="t2 pds-num">Due {dayLabel(jkt(b.balance_due_at).date)}, {timeLabel(b.balance_due_at)}. Pay now online or at the desk.</p> : null}
            {paying ? (
              <Card surface="public" className="stack-4">
                <p className="sum-total pds-num">{money(balance)}</p>
                <PayMethods value={method} onChange={setMethod} />
                {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
                <div className="row">
                  <Button disabled={busy} onClick={payBalance}>{busy ? "Confirming payment" : `Pay ${money(balance)} with ${PAY_LABEL[method]}`}</Button>
                  <button type="button" className="textbtn" onClick={() => setPaying(false)}>Not now</button>
                </div>
              </Card>
            ) : (
              <div><Button onClick={() => setPaying(true)}>Pay balance now</Button></div>
            )}
          </div>
        ) : null}
        {credit > 0 && !ended ? <p className="t2 pds-num">{money(credit)} is on your balance as credit. Use it at the desk.</p> : null}
        {!ended ? (
          <div className="tact">
            <p className="pds-label">Bring your players</p>
            <p className="t2">Send the game to your group and put it in your calendar.</p>
            <div className="row">
              <Button variant="secondary" icon={ShareIcon} onClick={share}>Send to players</Button>
              <Button variant="secondary" icon={CalendarDaysIcon} onClick={calendar}>Calendar</Button>
            </div>
            {note ? <p className="t2" role="status">{note}</p> : null}
          </div>
        ) : null}
        {!ended ? (
          <div className="tact">
            <p className="pds-label">Need to move it?</p>
            {moveClosed ? (
              <>
                <div><Button variant="secondary" icon={ArrowPathIcon} disabled aria-describedby="move-why">Reschedule</Button></div>
                <p id="move-why" className="t2">Moves close {rh} hours before play. Message the desk if you need help.</p>
              </>
            ) : (
              <>
                <p className="t2">Free up to {rh} hours before you play.</p>
                <div>
                  <Link to="/reschedule/$code" params={{ code: b.code }} className="pds-btn pds-btn--public pds-btn--secondary">Reschedule</Link>
                </div>
              </>
            )}
          </div>
        ) : null}
        {ended ? <div><Link to="/book" className="textlink">Book another slot</Link></div> : null}
      </div>
    </div>
  );
}
