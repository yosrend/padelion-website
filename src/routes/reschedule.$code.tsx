import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Slot, SlotGrid } from "@/design-system/padelion";
import { SiteFooter, TopBar } from "@/components/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { availabilityQuery, catalogQuery, settingsQuery } from "@/lib/queries";
import {
  CLOSE_MIN, OPEN_MIN, addDays, dayLabel, hm, idr, isoAt, jkt, overlaps, priceFor, recallWa, timeLabel, todayJkt, type BookingView,
} from "@/lib/padel";

import { useMoney } from "@/lib/currency";
export const Route = createFileRoute("/reschedule/$code")({
  head: () => ({
    meta: [
      { title: "Move your game at Padelion" },
      { name: "description", content: "Pick a new day, court or time for your padel booking. Same code, no chat needed." },
      { property: "og:title", content: "Move your game at Padelion" },
      { property: "og:description", content: "Pick a new day, court or time for your padel booking. Same code, no chat needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReschedulePage,
});

const DURATIONS = [60, 90, 120];

function ReschedulePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [wa, setWa] = useState<string | null>(null);
  useEffect(() => {
    const w = recallWa(code);
    if (!w) navigate({ to: "/booking/$code", params: { code }, replace: true });
    setWa(w);
  }, [code, navigate]);
  return (
    <>
      <TopBar />
      {wa ? <Move code={code} wa={wa} /> : <main className="wrap section" />}
      <SiteFooter />
    </>
  );
}

function Move({ code, wa }: { code: string; wa: string }) {
  const money = useMoney();
  const navigate = useNavigate();
  const b = useQuery({
    queryKey: ["booking", code, wa],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_booking", { _code: code, _wa: wa });
      if (error) throw error;
      return data as unknown as BookingView | null;
    },
  });
  const st = useQuery(settingsQuery);
  const cat = useQuery(catalogQuery);
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(90);
  const [start, setStart] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const bk = b.data;
  useEffect(() => {
    setToday(todayJkt());
    setNowMs(Date.now());
  }, []);
  useEffect(() => {
    if (!bk) return;
    setDate(jkt(bk.starts_at).date);
    setCourtId(bk.court_id);
    setMinutes(bk.minutes);
  }, [bk?.code]);
  useEffect(() => setStart(null), [date, courtId, minutes]);

  const avail = useQuery({ ...availabilityQuery(date ?? ""), enabled: !!date });
  // Your own booking does not block your move.
  const busyList = useMemo(
    () => (avail.data ?? []).filter((x) => !(bk && x.court_id === bk.court_id && x.kind === "booked" && new Date(x.starts_at).getTime() === new Date(bk.starts_at).getTime())),
    [avail.data, bk],
  );
  const nowMins = today && date === today ? jkt(new Date()).mins : -1;
  const rule = cat.data?.prices.find((p) => p.court_id === courtId);
  const court = cat.data?.courts.find((c) => c.id === courtId);

  if (b.isLoading || !st.data) return <main className="wrap section"><p className="t2">Loading your booking</p></main>;
  if (!bk) return <main className="wrap section"><p className="t2">We could not find that booking.</p></main>;

  const rh = st.data.reschedule_hours;
  const cutoff = new Date(new Date(bk.starts_at).getTime() - rh * 3600000);
  const closed = nowMs != null && nowMs > cutoff.getTime();
  const movable = bk.status === "deposit_paid" || bk.status === "paid";

  const cells: number[] = [];
  for (let m = OPEN_MIN; m < CLOSE_MIN; m += 30) cells.push(m);
  const canStart = (m: number) => !!courtId && !!date && m > nowMins && m + minutes <= CLOSE_MIN && !overlaps(busyList, courtId, date, m, minutes);
  const sameAsNow = start != null && date === jkt(bk.starts_at).date && courtId === bk.court_id && start === jkt(bk.starts_at).mins && minutes === bk.minutes;
  const newTotal = start != null && date ? priceFor(rule, date, start, minutes) + bk.addons_idr : bk.total_idr;
  const diff = newTotal - bk.total_idr;
  const days = today ? Array.from({ length: 7 }, (_, i) => addDays(today, i)) : [];

  async function move() {
    if (start == null || !date || !courtId || !court) return;
    setErr(null);
    setBusy(true);
    const { error } = await supabase.rpc("reschedule_booking", { _code: code, _wa: wa, _court: courtId, _starts: isoAt(date, start), _minutes: minutes });
    setBusy(false);
    if (error) { setErr(error.message); avail.refetch(); return; }
    await b.refetch();
    navigate({ to: "/booking/$code", params: { code }, search: { moved: `${court.name}, ${hm(start)}` } });
  }

  return (
    <main className="wrap flow">
      <div className="stack-8">
        <div className="stack-3">
          <p className="meta pds-num">{bk.code}</p>
          <h1 className="pds-display">Move your game</h1>
          <p className="body-lg pds-num">Now: {bk.court}, {dayLabel(jkt(bk.starts_at).date)}, {timeLabel(bk.starts_at)} to {timeLabel(bk.ends_at)}.</p>
          <p className="t2 pds-num">Free until {dayLabel(jkt(cutoff.toISOString()).date)}, {timeLabel(cutoff.toISOString())}.</p>
        </div>

        {!movable || closed ? (
          <div className="stack-3">
            <p className="notice notice--error" role="alert">
              {!movable ? "Only paid bookings can be moved." : `Moves close ${rh} hours before play. Message the desk if you need help.`}
            </p>
            <Link to="/booking/$code" params={{ code }} className="textlink">Back to your ticket</Link>
          </div>
        ) : (
          <>
            <section className="block" aria-labelledby="d-h">
              <h2 id="d-h" className="pds-card-title">Pick your day</h2>
              <div className="row">
                {days.map((d, i) => (
                  <button key={d} type="button" className="chip-btn" aria-pressed={d === date} onClick={() => setDate(d)}>
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayLabel(d).split(" ")[0]!.replace(",", "")}
                    <small className="pds-num">{dayLabel(d)}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="block" aria-labelledby="c-h">
              <h2 id="c-h" className="pds-card-title">Court</h2>
              <div className="row">
                {cat.data?.courts.map((c) => (
                  <button key={c.id} type="button" className="chip-btn" aria-pressed={c.id === courtId} onClick={() => setCourtId(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
            <section className="block" aria-labelledby="l-h">
              <h2 id="l-h" className="pds-card-title">How long?</h2>
              <div className="row">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" className="chip-btn" aria-pressed={d === minutes} onClick={() => setMinutes(d)}>
                    <span className="pds-num">{d} min</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="block" aria-labelledby="t-h">
              <h2 id="t-h" className="pds-card-title">Open start times</h2>
              {avail.isLoading || !date ? <p className="t2">Checking open times</p> : (
                <SlotGrid>
                  {cells.filter((m) => canStart(m) || (start != null && m >= start && m < start + minutes)).map((m) => {
                    const inSel = start != null && m >= start && m < start + minutes;
                    const isEnd = start != null && m === start + minutes - 30;
                    return (
                      <Slot key={m} time={hm(m)} state={inSel ? (isEnd ? "range-end" : "selected") : "open"}
                        endLabel={`to ${hm(start! + minutes)}`} aria-label={`Start at ${hm(m)}`}
                        onClick={() => canStart(m) && setStart(m)} />
                    );
                  })}
                </SlotGrid>
              )}
            </section>
          </>
        )}
      </div>

      {movable && !closed ? (
        <aside className="flow__aside">
          <Card surface="public" className="stack-4">
            <p className="meta">New time</p>
            <p className="pds-card-title">{court?.name}{date ? `, ${dayLabel(date)}` : ""}</p>
            <p className="t2 pds-num">{start != null ? `${hm(start)} to ${hm(start + minutes)}` : "Pick a start time"}</p>
            <hr className="divider" />
            {start != null && !sameAsNow ? (
              <p className="pds-label pds-num" aria-live="polite">
                {diff > 0 ? `You pay ${money(diff)} more` : diff < 0 ? (bk.paid_idr > newTotal ? `${money(bk.paid_idr - newTotal)} goes to your balance as credit` : `${money(-diff)} comes off what you still owe`) : "Same price"}
              </p>
            ) : null}
            {diff > 0 && start != null ? <p className="t2">Pay it from your ticket with Pay balance now, or at the desk.</p> : null}
            {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
            <Button className="full" disabled={start == null || sameAsNow || busy} onClick={move}>
              {busy ? "Moving your game" : "Move my game"}
            </Button>
            <Link to="/booking/$code" params={{ code }} className="textlink">Keep my current time</Link>
          </Card>
        </aside>
      ) : null}
    </main>
  );
}
