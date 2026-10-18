import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { Button, Glass } from "@/design-system/padelion";
import { catalogQuery, settingsQuery } from "@/lib/queries";
import { hm, jkt, todayJkt } from "@/lib/padel";
import { useMoney } from "@/lib/currency";
import { photos } from "@/lib/landing-photos";

const OPEN = 6;
const CLOSE = 23;
const TICKS = [6, 9, 12, 15, 17, 20, 23];
const pct = (h: number) => ((h - OPEN) / (CLOSE - OPEN)) * 100;

/**
 * Prices as the day looks at the venue: one track per court from 06.00 to 23.00,
 * the off-peak and peak hours drawn to scale, and a marker for right now.
 */
export function PriceBoard() {
  const money = useMoney();
  const navigate = useNavigate();
  const catalog = useQuery(catalogQuery);
  const [now, setNow] = useState<{ mins: number; weekend: boolean } | null>(null);
  const [weekend, setWeekend] = useState(false);
  useEffect(() => {
    const t = todayJkt();
    const dow = new Date(`${t}T12:00:00+07:00`).getUTCDay();
    const we = dow === 0 || dow === 6;
    setNow({ mins: jkt(new Date()).mins, weekend: we });
    setWeekend(we);
  }, []);

  const rules = catalog.data?.prices ?? [];
  const courts = catalog.data?.courts ?? [];
  const ruleFor = (sort: number) => rules.find((r) => courts.find((c) => c.id === r.court_id)?.sort === sort);
  const blue = ruleFor(1) ?? { off_peak_idr: 350000, peak_idr: 550000, weekday_peak_start: 17, weekday_peak_end: 23, weekend_all_peak: true };
  const green = ruleFor(3) ?? { off_peak_idr: 400000, peak_idr: 600000, weekday_peak_start: 17, weekday_peak_end: 23, weekend_all_peak: true };
  const rows = [
    { name: "Court 1 and Court 2", note: "Blue, under the dome", r: blue, green: false },
    { name: "Court 3", note: "Center court, neon green", r: green, green: true },
  ];
  const showNow = now && now.weekend === weekend && now.mins >= OPEN * 60 && now.mins <= CLOSE * 60;

  return (
    <section id="prices" className="section wrap pboard">
      <div className="pboard__head">
        <h2 className="pds-section-title rise">What an hour costs, before you ask.</h2>
        <div className="seg-pill pboard__days" role="group" aria-label="Day">
          <button type="button" aria-pressed={!weekend} onClick={() => setWeekend(false)}>Monday to Friday</button>
          <button type="button" aria-pressed={weekend} onClick={() => setWeekend(true)}>Weekend</button>
        </div>
      </div>

      <div className="pboard__board" role="table" aria-label={`Prices per court, ${weekend ? "weekend" : "Monday to Friday"}`}>
        {rows.map(({ name, note, r, green: g }) => {
          const peakFrom: number = weekend && r.weekend_all_peak ? OPEN : r.weekday_peak_start ?? 17;
          const peakTo: number = weekend && r.weekend_all_peak ? CLOSE : r.weekday_peak_end ?? CLOSE;
          return (
            <div key={name} className="pboard__row" role="row">
              <div className="pboard__court" role="rowheader">
                <span className={`court-dot${g ? " court-dot--green" : ""}`} aria-hidden="true" />
                <span>
                  <span className="pboard__name">{name}</span>
                  <span className="pboard__note">{note}</span>
                </span>
              </div>
              <div className="pboard__track" role="cell">
                {peakFrom > OPEN ? (
                  <span className="pboard__band pboard__band--off" style={{ left: 0, width: `${pct(peakFrom)}%` }}>
                    <span className="pboard__price pds-num">{money(r.off_peak_idr)}</span>
                    <span className="pboard__unit">an hour, {hm(OPEN * 60)} to {hm(peakFrom * 60)}</span>
                  </span>
                ) : null}
                <span className={`pboard__band pboard__band--peak${g ? " pboard__band--green" : ""}`} style={{ left: `${pct(peakFrom)}%`, width: `${pct(peakTo) - pct(peakFrom)}%` }}>
                  <span className="pboard__price pds-num">{money(r.peak_idr)}</span>
                  <span className="pboard__unit">{peakFrom === OPEN ? "an hour, all day" : "peak"}</span>
                </span>
              </div>
            </div>
          );
        })}
        <div className="pboard__axis" aria-hidden="true">
          <span />
          <div className="pboard__ticks">
            {TICKS.map((h) => <span key={h} className={`pds-num${[9, 15, 20].includes(h) ? " pboard__tick--minor" : ""}`} style={{ left: `${pct(h)}%` }}>{hm(h * 60)}</span>)}
            {showNow ? (
              <span className={`pboard__now${pct(now!.mins / 60) > 70 ? " pboard__now--flip" : ""}`} style={{ left: `${pct(now!.mins / 60)}%` }}>
                <span className="pds-num">Now {hm(now!.mins)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pboard__foot">
        <p className="pboard__split pds-num">
          One price for the court, however many of you play. Split four ways, a peak hour on Court 2 is <strong>{money(137500)}</strong> each.
        </p>
        <div className="pboard__more">
          <p className="t2 pds-num">At the desk: rackets {money(35000)}, a can of balls {money(60000)}, a towel {money(15000)}.</p>
          <Button onClick={() => navigate({ to: "/book" })}>Check open times</Button>
        </div>
      </div>
    </section>
  );
}

const ARRIVE = [
  { when: "15 minutes before", t: "Park and walk in", d: "Free parking for 20 cars, right at the dome." },
  { when: "At the desk", t: "Show your ticket", d: "Or scan the QR at the screen by your court." },
  { when: "Before you play", t: "Change and warm up", d: "Free showers and lockers. Bring your own lock." },
  { when: "On court", t: "Clean shoes only", d: "Non-marking soles. Street shoes stay off the court." },
];

/** Visit: the dome as the backdrop, the address on it, and what happens from the car park to the court. */
export function VisitSection() {
  return (
    <section id="visit" className="section wrap visit2">
      <div className="visit2__photo">
        <img src={photos.visit.src} alt={photos.visit.alt} loading="lazy" width={1024} height={768} />
        <div className="visit2__shade" aria-hidden="true" />
        <Glass className="visit2__card">
          <h2 className="visit2__title rise">Find us on Kemang Raya</h2>
          <p className="visit2__addr pds-num"><strong>Jl. Kemang Raya, South Jakarta</strong>Open every day, 06.00 to 23.00</p>
          <div className="visit2__actions">
            <a className="visit2__maps" href="https://www.google.com/maps/search/?api=1&query=Jl.+Kemang+Raya,+South+Jakarta" target="_blank" rel="noopener noreferrer">
              <MapPinIcon aria-hidden="true" /> Open in Google Maps
            </a>
            <Link to="/find" className="visit2__find">Find your booking</Link>
          </div>
        </Glass>
      </div>
      <ol className="arrive" aria-label="When you arrive">
        {ARRIVE.map((a) => (
          <li key={a.t} className="arrive__step">
            <span className="arrive__when">{a.when}</span>
            <span className="arrive__t">{a.t}</span>
            <span className="arrive__d">{a.d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The fine print, all open: short questions a player actually asks, answered in one or two lines. */
export function FinePrint() {
  const s = useQuery(settingsQuery).data;
  const hold = s?.hold_minutes ?? 15;
  const dep = s?.deposit_pct ?? 50;
  const bal = s?.balance_hours ?? 2;
  const move = s?.reschedule_hours ?? 12;
  const items = [
    { q: "Do I need an account?", a: "No. You book as a guest with your name and WhatsApp number. Your booking code does the rest." },
    { q: "How long is my time held?", a: `${hold} minutes from the moment you tap Hold. Pay within that time and the court is yours.` },
    { q: "How much do I pay now?", a: `${dep}% of the total, or all of it. The rest is due ${bal} hours before you play.` },
    { q: "Can I move my booking?", a: `Yes, from your ticket, free up to ${move} hours before you play.` },
    { q: "The time I want is taken.", a: `Tap it and join the waitlist. If it frees up, it is offered to you on WhatsApp and held for ${hold} minutes.` },
    { q: "Does rain stop play?", a: "No, the courts are under the dome. If the roads flood, we offer you a later time for free." },
  ];
  return (
    <section className="section wrap fine">
      <h2 className="pds-section-title rise fine__title">The fine print, in plain words</h2>
      <dl className="fine__list">
        {items.map((i) => (
          <div key={i.q} className="fine__item">
            <dt>{i.q}</dt>
            <dd className="pds-num">{i.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
