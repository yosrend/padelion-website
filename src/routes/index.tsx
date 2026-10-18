import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRightIcon,
  KeyIcon,
  TruckIcon,
  ClockIcon,
  MapPinIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";
import { Accordion, Button, Glass, RadioCard } from "@/design-system/padelion";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { Walkthrough } from "@/components/landing/Walkthrough";
import { LazyStage } from "@/components/landing/LazyStage";
import { HeroScrub } from "@/components/landing/HeroScrub";
import { UpdatesChat } from "@/components/landing/UpdatesChat";
import { FinePrint, PriceBoard, VisitSection } from "@/components/landing/Sections";
import { GallerySection, MembershipSection } from "@/components/landing/ClubSections";
import type { RacketKind } from "@/components/landing/RacketScene";
import { courtLook, photos } from "@/lib/landing-photos";
import { AddonThumb } from "@/components/player/AddonThumb";
import { availabilityQuery, catalogQuery } from "@/lib/queries";
import { CLOSE_MIN, OPEN_MIN, addDays, dayLabel, hm, idr, jkt, overlaps, priceFor, todayJkt } from "@/lib/padel";

const CourtScene = lazy(() => import("@/components/landing/CourtScene"));
const RacketScene = lazy(() => import("@/components/landing/RacketScene"));

import { useMoney } from "@/lib/currency";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Padelion Kemang, your court locked in 60 seconds" },
      { name: "description", content: "Book a padel court in Kemang, South Jakarta. Pick a time, pay online, done. No account, no WhatsApp chat." },
      { property: "og:title", content: "Padelion Kemang, your court locked in 60 seconds" },
      { property: "og:description", content: "Three padel courts on Jl. Kemang Raya. Book and pay in about 60 seconds, as a guest." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "preload", as: "image", href: "/hero/hero-poster.jpg", fetchPriority: "high" }],
  }),
  component: Landing,
});

function useToday() {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(todayJkt()), []);
  return today;
}

const LEN = 90;

type NextSlot = { date: string; mins: number; court: string; courtId: string; price: number };

// The first 90 minute slot that is open on any court, today or tomorrow.
function useNextOpen(): { today: string | null; found: NextSlot | null } {
  const today = useToday();
  const catalog = useQuery({ ...catalogQuery, enabled: !!today });
  const day0 = useQuery({ ...availabilityQuery(today ?? ""), enabled: !!today });
  const day1 = useQuery({ ...availabilityQuery(today ? addDays(today, 1) : ""), enabled: !!today });

  let found: NextSlot | null = null;
  if (today && catalog.data && day0.data && day1.data) {
    const nowMins = jkt(new Date()).mins;
    for (const [date, busy] of [[today, day0.data], [addDays(today, 1), day1.data]] as const) {
      for (let m = OPEN_MIN; m + LEN <= CLOSE_MIN && !found; m += 30) {
        if (date === today && m <= nowMins) continue;
        const c = catalog.data.courts.find((ct) => !overlaps(busy, ct.id, date, m, LEN));
        if (c) {
          const rule = catalog.data.prices.find((p) => p.court_id === c.id);
          found = { date, mins: m, court: c.name, courtId: c.id, price: priceFor(rule, date, m, LEN) };
        }
      }
      if (found) break;
    }
  }
  return { today, found };
}

function NextOpen() {
  const money = useMoney();
  const navigate = useNavigate();
  const { today, found } = useNextOpen();

  return (
    <Glass className="next-card stack-3">
      <p className="muted pds-label">Next open{found && found.date !== today ? `, ${dayLabel(found.date)}` : ""}</p>
      {found ? (
        <>
          <p className="next-card__time pds-num">
            {found.court}, {hm(found.mins)}
          </p>
          <p className="muted pds-num">
            {LEN} min, {money(found.price)}
          </p>
          <button
            type="button"
            className="glass-btn"
            onClick={() =>
              navigate({ to: "/book", search: { court: found!.courtId, date: found!.date, start: found!.mins, minutes: LEN } })
            }
          >
            Hold it
          </button>
        </>
      ) : (
        <p className="muted">Checking the courts</p>
      )}
    </Glass>
  );
}

// The front door: day, rough start time and length, then straight into /book with the closest open time picked.
function QuickSearch() {
  const navigate = useNavigate();
  const today = useToday();
  const [day, setDay] = useState<string>("");
  const [at, setAt] = useState(19 * 60);
  const [len, setLen] = useState(LEN);

  useEffect(() => {
    if (!today) return;
    const late = jkt(new Date()).mins + 60 > CLOSE_MIN;
    setDay(late ? addDays(today, 1) : today);
    const next = Math.ceil((jkt(new Date()).mins + 30) / 60) * 60;
    if (!late && next > at) setAt(Math.min(next, CLOSE_MIN - 60));
  }, [today]);

  const days = today ? Array.from({ length: 7 }, (_, i) => addDays(today, i)) : [];
  const hours: number[] = [];
  for (let m = OPEN_MIN; m + 60 <= CLOSE_MIN; m += 60) hours.push(m);

  return (
    <form
      className="qsearch"
      aria-label="Check open times"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ to: "/book", search: { date: day || undefined, start: at, minutes: len } });
      }}
    >
      <label className="qsearch__f">
        <span>Day</span>
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          {days.map((d, i) => (
            <option key={d} value={d}>{i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayLabel(d)}</option>
          ))}
        </select>
      </label>
      <label className="qsearch__f">
        <span>Start around</span>
        <select value={at} onChange={(e) => setAt(Number(e.target.value))}>
          {hours.map((m) => <option key={m} value={m}>{hm(m)}</option>)}
        </select>
      </label>
      <label className="qsearch__f">
        <span>Play for</span>
        <select value={len} onChange={(e) => setLen(Number(e.target.value))}>
          {[60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
        </select>
      </label>
      <button type="submit" className="qsearch__go">
        Check open times <ArrowRightIcon aria-hidden="true" />
      </button>
    </form>
  );
}

// Closing call to action: names the real next open slot instead of a fixed time.
function ClosingCta() {
  const navigate = useNavigate();
  const { today, found } = useNextOpen();
  const when = found ? (found.date === today ? "Tonight in Kemang" : `${dayLabel(found.date)} in Kemang`) : "In Kemang";
  const line = found ? `${found.court} is still open at ${hm(found.mins)}.` : "Your court, a minute from now.";

  return (
    <section className="cta wrap">
      <img className="hero__img" src={photos.cta.src} alt={photos.cta.alt} loading="lazy" width={1920} height={1088} />
      <div className="hero__shade" aria-hidden="true" />
      <div className="cta__body stack-6">
        <p className="hero__meta">{when}</p>
        <h2 className="pds-display rise">{line}</h2>
        <div className="row">
          <Button
            icon={CheckBadgeIcon}
            onClick={() =>
              found
                ? navigate({ to: "/book", search: { court: found.courtId, date: found.date, start: found.mins, minutes: LEN } })
                : navigate({ to: "/book" })
            }
          >
            Book a court
          </Button>
        </div>
      </div>
    </section>
  );
}

// The selected court from the 3D section: what it is, what it costs, and the next open times to hold right away.
function CourtDetail({ court }: { court: { id: string; name: string; kind: string } }) {
  const money = useMoney();
  const navigate = useNavigate();
  const today = useToday();
  const catalog = useQuery(catalogQuery);
  const day0 = useQuery({ ...availabilityQuery(today ?? ""), enabled: !!today });
  const day1 = useQuery({ ...availabilityQuery(today ? addDays(today, 1) : ""), enabled: !!today });
  const [pick, setPick] = useState<number | null>(null);
  const look = courtLook(court);
  const rule = catalog.data?.prices.find((p) => p.court_id === court.id);

  let date: string | null = null;
  let times: number[] = [];
  if (today && day0.data && day1.data) {
    const now = jkt(new Date()).mins;
    for (const [d, busy] of [[today, day0.data], [addDays(today, 1), day1.data]] as const) {
      const t: number[] = [];
      for (let m = OPEN_MIN; m + LEN <= CLOSE_MIN && t.length < 3; m += 30) {
        if (d === today && m <= now) continue;
        if (!overlaps(busy, court.id, d, m, LEN)) t.push(m);
      }
      if (t.length) { date = d; times = t; break; }
    }
  }
  useEffect(() => setPick(null), [court.id]);
  const chosen = pick != null && times.includes(pick) ? pick : times[0];

  return (
    <div className="court-detail">
      <div className="court-detail__head">
        <p className="court-detail__name">{court.name}, {look.short}</p>
        <p className="t3 pds-num">{date ? (date === today ? "Next open today" : `Next open ${dayLabel(date)}`) : "Checking"}</p>
      </div>
      <dl className="court-detail__facts">
        <div><dt>Surface</dt><dd>Blue synthetic turf</dd></div>
        <div><dt>Walls</dt><dd>{look.walls}</dd></div>
        <div><dt>Off-peak</dt><dd className="pds-num">{rule ? `${money(rule.off_peak_idr)} / hour` : " "}</dd></div>
        <div><dt>Peak</dt><dd className="pds-num">{rule ? `${money(rule.peak_idr)} / hour` : " "}</dd></div>
      </dl>
      {times.length ? (
        <>
          <div className="court-detail__times" role="group" aria-label={`Open start times on ${court.name}`}>
            {times.map((m) => (
              <button key={m} type="button" className="pds-num" aria-pressed={m === chosen} onClick={() => setPick(m)}>{hm(m)}</button>
            ))}
          </div>
          <button
            type="button"
            className="court-detail__cta"
            onClick={() => navigate({ to: "/book", search: { court: court.id, date: date!, start: chosen, minutes: LEN } })}
          >
            Hold {hm(chosen)} on {court.name}
          </button>
        </>
      ) : null}
    </div>
  );
}

function CourtsSection() {
  const today = useToday();
  const catalog = useQuery(catalogQuery);
  const avail = useQuery({ ...availabilityQuery(today ?? ""), enabled: !!today });
  const [selected, setSelected] = useState(2);
  const [focus, setFocus] = useState(false);
  const progress = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
      progress.current = Math.min(1, Math.max(0, p));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const courts = catalog.data?.courts ?? [];
  const openCount = (id: string) => {
    if (!today || !avail.data) return null;
    const now = jkt(new Date()).mins;
    let n = 0;
    for (let m = OPEN_MIN; m + 60 <= CLOSE_MIN; m += 30) if (m > now && !overlaps(avail.data, id, today, m, 60)) n++;
    return n;
  };
  const openLabel = (n: number | null) => {
    if (n == null) return "Checking today";
    if (n > 0) return n >= 24 ? "Mostly free today" : `${Math.floor(n / 2) || 1} ${n < 4 ? "hour" : "hours"} still free today`;
    // After the last start time of the day, say when it opens instead of "0 open".
    return jkt(new Date()).mins + 60 > CLOSE_MIN ? `Closed now, opens ${hm(OPEN_MIN)} tomorrow` : "Full today, join the waitlist";
  };
  const fallback = <img className="courts__img" src={photos.courtsFallback.src} alt={photos.courtsFallback.alt} loading="lazy" width={1280} height={960} />;

  return (
    <section id="courts" ref={sectionRef} className="section ink wrap">
      <div className="stack-8">
        <div className="stack-4">
          <p className="t2 pds-label">Two blue courts, one neon green</p>
          <h2 className="pds-display rise">Pick the court you actually want.</h2>
        </div>
        <div className="courts">
          <div className="courts__view">
            <LazyStage className="courts__stage" fallback={fallback}>
              <CourtScene selected={selected} focus={focus} onPick={(i) => { setSelected(i); setFocus(true); }} progress={progress} />
            </LazyStage>
            <div className="courts__hud">
              <span className="courts__hint">
                {focus ? "Drag to look around. Scroll or pinch to zoom." : "Tap a court to fly in. Drag to turn."}
              </span>
              {focus ? (
                <button type="button" className="courts__back" onClick={() => setFocus(false)}>All courts</button>
              ) : null}
            </div>
          </div>
          <div className="courts__side">
            <div className="courts__list" role="radiogroup" aria-label="Courts">
              {courts.map((c, i) => {
                const n = openCount(c.id);
                return (
                  <RadioCard key={c.id} role="radio" aria-checked={i === selected} selected={i === selected} onClick={() => { setSelected(i); setFocus(true); }}>
                    <span className="stack-2">
                      <span className="meta">{courtLook(c).label}</span>
                      <span className="pds-card-title">{c.name}</span>
                      <span className="pds-meta pds-num">{openLabel(n)}</span>
                    </span>
                  </RadioCard>
                );
              })}
            </div>
            {courts[selected] ? <CourtDetail court={courts[selected]} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

const RACKETS: { kind: RacketKind; t: string; level: string; d: string; specs: [string, string][] }[] = [
  {
    kind: "control", t: "Control", level: "New to padel",
    d: "Round head, low balance. The ball goes where you aim, and it is easy on the arm.",
    specs: [["Head", "Round"], ["Weight", "355 g"], ["Balance", "Low"], ["Core", "Soft foam"]],
  },
  {
    kind: "balanced", t: "Balanced", level: "Most players",
    d: "Teardrop head. Enough control to place it, enough punch to finish the point.",
    specs: [["Head", "Teardrop"], ["Weight", "365 g"], ["Balance", "Medium"], ["Core", "Medium foam"]],
  },
  {
    kind: "power", t: "Power", level: "Already playing",
    d: "Diamond head, weight up top. Built for the smash, less forgiving off centre.",
    specs: [["Head", "Diamond"], ["Weight", "370 g"], ["Balance", "High"], ["Core", "Firm foam"]],
  },
];

const BEFORE = [
  { i: MapPinIcon, t: "Address", d: "Jl. Kemang Raya, South Jakarta" },
  { i: ClockIcon, t: "Open hours", d: "Daily, 06.00 to 23.00" },
  { i: TruckIcon, t: "Parking", d: "Free, for 20 cars on site." },
  { i: KeyIcon, t: "Showers and lockers", d: "Free for players. Bring your own lock." },
  { i: UserGroupIcon, t: "Arrive 15 minutes early", d: "Check in at the desk, then warm up." },
  { i: ShieldCheckIcon, t: "Clean court shoes", d: "Non-marking soles only. Street shoes stay off the court." },
];

function RentalsSection() {
  const money = useMoney();
  const [pick, setPick] = useState<RacketKind>("balanced");
  const r = RACKETS.find((x) => x.kind === pick)!;
  return (
    <section id="rentals" className="section wrap">
      <div className="rent">
        <div className="rent__head stack-4">
            <p className="t2 pds-label">Rackets at the desk</p>
            <h2 className="pds-display rise">Forgot your racket? Pick one with the court.</h2>
            <p className="rent__lede">Choose the one that fits your game while you book. It waits at the desk when you arrive, {money(35000)} a game, with balls and a towel if you add them.</p>
        </div>
        <div className="rent__list" role="radiogroup" aria-label="Rental rackets">
            {RACKETS.map((x) => (
              <button key={x.kind} type="button" role="radio" aria-checked={x.kind === pick} className="rent__row" onClick={() => setPick(x.kind)}>
                <AddonThumb name={`Racket, ${x.t}`} />
                <span className="rent__name">
                  <span className="pds-card-title">{x.t}</span>
                  <span className="t2">{x.level}</span>
                </span>
              </button>
            ))}
        </div>
        <div className="rent__view">
          <LazyStage
            className="rent__stage"
            fallback={
              <div className="rent__ph" aria-hidden="true">
                <AddonThumb name={`Racket, ${r.t}`} drawn />
              </div>
            }
          >
            <RacketScene kind={pick} />
          </LazyStage>
          <span className="rent__hint">Drag to turn it</span>
        </div>
        <div key={r.kind} className="rent__card" aria-live="polite">
            <div className="rent__card-head">
              <div>
                <p className="rent__card-name">{r.t}</p>
                <p className="rent__card-level">{r.level}</p>
              </div>
              <p className="rent__card-price pds-num">{money(35000)}<span> per game</span></p>
            </div>
            <p className="rent__card-desc">{r.d}</p>
            <dl className="rent__specs">
              {r.specs.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
        </div>
      </div>
    </section>
  );
}

function Landing() {
  const money = useMoney();
  const navigate = useNavigate();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.registerPlugin(ScrollTrigger);
      gsap.utils.toArray<HTMLElement>(".rise").forEach((el) => {
        gsap.from(el, {
          y: 24,
          opacity: 0,
          duration: 0.6,
          ease: "power4.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      });
    },
    { scope: root },
  );

  return (
    <main ref={root}>
      <SiteNav over />
      <HeroScrub>
        <div className="hero__body">
          <div className="stack-6">
            <h1 className="pds-hero hero__h1" aria-label="Your court, locked in 60 seconds.">
              {"Your court, locked in 60 seconds.".split(" ").map((w, i) => (
                <span key={i} className="w" style={{ ["--i" as string]: i }} aria-hidden="true">{w}{"\u00a0"}</span>
              ))}
            </h1>
            <p className="hero__lede">Pick a time and pay with Apple Pay, Google Pay or card. Your ticket lands on WhatsApp before you put the phone down.</p>
            <QuickSearch />
          </div>
          <NextOpen />
        </div>
      </HeroScrub>

      <PriceBoard />

      <section id="how" className="section wrap">
        <Walkthrough
          intro={
            <div className="stack-4">
                            <h2 className="pds-section-title rise">From open time to ticket in four taps.</h2>
              <p className="body-lg">About a minute on your phone, as a guest. Your name and WhatsApp number are all we ask for.</p>
            </div>
          }
        />
      </section>

      <CourtsSection />

      <section className="section wrap">
        <UpdatesChat
          head={
            <div className="uchat__head">
              <h2 className="pds-section-title rise">After you book, we do the messaging.</h2>
              <p className="body-lg">Reminders, rain plans and freed-up courts arrive on WhatsApp, so you never chase the desk for an answer.</p>
            </div>
          }
        />
      </section>

      <RentalsSection />

      <GallerySection />

      <MembershipSection />

      <VisitSection />

      <FinePrint />

      <ClosingCta />

      <SiteFooter />
    </main>
  );
}
