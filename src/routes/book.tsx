import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneField } from "@/components/player/PhoneField";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, CalendarDaysIcon, CheckCircleIcon, MapPinIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { DatePicker } from "@/components/player/DatePicker";
import { courtLook } from "@/lib/landing-photos";
import { Button, Card, Input, RadioCard, Slot, SlotGrid } from "@/design-system/padelion";
import { FlowSteps, TopBar } from "@/components/SiteChrome";
import { WaitlistSheet } from "@/components/player/WaitlistSheet";
import { AddonThumb, addonNote } from "@/components/player/AddonThumb";
import { normalizeWa, rules, useFieldErrors } from "@/lib/validate";
import { supabase } from "@/integrations/supabase/client";
import { availabilityQuery, catalogQuery, settingsQuery } from "@/lib/queries";
import {
  CLOSE_MIN, OPEN_MIN, addDays, dayLabel, hm, idr, isPeak, isoAt, jkt, overlaps, priceFor, recallWa, rememberWa, todayJkt, type BookingView,
} from "@/lib/padel";

import { useMoney } from "@/lib/currency";
export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book your court at Padelion Kemang" },
      { name: "description", content: "Pick a court, a day and a time. Your slot is held for 15 minutes while you pay." },
      { property: "og:title", content: "Book your court at Padelion Kemang" },
      { property: "og:description", content: "Pick a court, a day and a time. Your slot is held for 15 minutes while you pay." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { court?: string; date?: string; start?: number; minutes?: number; review?: string } => ({
    court: typeof s.court === "string" ? s.court : undefined,
    // a real calendar date only: 2026-13-01 or 2026-02-31 are dropped instead of crashing the page
    date: typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && new Date(`${s.date}T12:00:00Z`).toISOString().slice(0, 10) === s.date ? s.date : undefined,
    review: typeof s.review === "string" && /^PDL-\d{1,8}$/i.test(s.review) ? s.review.toUpperCase() : undefined,
    start: s.start != null && !Number.isNaN(Number(s.start)) ? Number(s.start) : undefined,
    minutes: [60, 90, 120].includes(Number(s.minutes)) ? Number(s.minutes) : undefined,
  }),
  component: BookPage,
});

const DURATIONS = [60, 90, 120];

function BookPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const presetStart = useRef<number | undefined>(search.start);
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [courtId, setCourtId] = useState<string | null>(search.court ?? null);
  const [minutes, setMinutes] = useState(search.minutes ?? 90);
  const [start, setStart] = useState<number | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [pickDate, setPickDate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busySubmit, setBusySubmit] = useState(false);
  const [waitTap, setWaitTap] = useState<number | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);

  useEffect(() => {
    const t = todayJkt();
    setToday(t);
    // After the last start time of the day, open on tomorrow instead of a closed today.
    const closedNow = jkt(new Date()).mins + 60 > CLOSE_MIN;
    const first = closedNow ? addDays(t, 1) : t;
    setDate(search.date && search.date >= first ? search.date : first);
  }, []);

  const catalog = useQuery(catalogQuery);
  const review = useQuery({
    queryKey: ["booking-review", search.review],
    enabled: !!search.review,
    queryFn: async () => {
      const w = recallWa(search.review!);
      if (!w) return null;
      const { data } = await supabase.rpc("get_booking", { _code: search.review!, _wa: w });
      return (data as unknown as BookingView | null) ?? null;
    },
  });
  // Carry the details already given into the form, so going back to check changes nothing by accident.
  const filled = useRef(false);
  useEffect(() => {
    const b = review.data;
    if (!b || filled.current || !catalog.data) return;
    filled.current = true;
    setName(b.guest_name);
    setWa(recallWa(b.code) ?? "");
    if (b.note) setNote(b.note);
    const q: Record<string, number> = {};
    for (const a of b.addons) { const hit = catalog.data.addons.find((x) => x.name === a.name); if (hit) q[hit.id] = a.qty; }
    setQty(q);
  }, [review.data, catalog.data]);
  const settings = useQuery(settingsQuery);
  const avail = useQuery({ ...availabilityQuery(date ?? ""), enabled: !!date });

  useEffect(() => {
    if (!courtId && catalog.data?.courts[0]) setCourtId(catalog.data.courts[0].id);
  }, [catalog.data, courtId]);

  // Reset the picked time when the context changes.
  const keepStart = useRef(false);
  useEffect(() => {
    if (keepStart.current) {
      keepStart.current = false;
      return;
    }
    setStart(null);
    setWaitTap(null);
  }, [date, courtId, minutes]);

  // A time handed over from the landing page (quick search, next open, hold buttons).
  // Take the closest time to it that is really open, on the asked court first, then any court.
  useEffect(() => {
    const want = presetStart.current;
    if (want == null || !date || !avail.data || !catalog.data) return;
    if (search.review && review.isLoading) return;
    presetStart.current = undefined;
    const own = review.data;
    const list = avail.data.filter((x) => !(own && x.court_id === own.court_id && new Date(x.starts_at).getTime() === new Date(own.starts_at).getTime()));
    const now = today && date === today ? jkt(new Date()).mins : -1;
    const ids = catalog.data.courts.map((c) => c.id);
    const order = search.court && ids.includes(search.court) ? [search.court, ...ids.filter((i) => i !== search.court)] : ids;
    const times: number[] = [];
    for (let m = OPEN_MIN; m < CLOSE_MIN; m += 30) times.push(m);
    times.sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
    for (const m of times) {
      if (m <= now || m + minutes > CLOSE_MIN) continue;
      const c = order.find((id) => !overlaps(list, id, date, m, minutes));
      if (c) {
        if (c !== courtId) {
          keepStart.current = true;
          setCourtId(c);
        }
        setStart(m);
        return;
      }
    }
  }, [avail.data, catalog.data, date, review.isLoading]);

  const court = catalog.data?.courts.find((c) => c.id === courtId);
  const rule = catalog.data?.prices.find((p) => p.court_id === courtId);
  // Back from Details and pay: the player's own hold is shown as their pick, not as a taken slot.
  const rb = review.data;
  const busy = (avail.data ?? []).filter((x) => !(rb && x.court_id === rb.court_id && new Date(x.starts_at).getTime() === new Date(rb.starts_at).getTime()));
  const nowMins = today && date === today ? jkt(new Date()).mins : -1;

  const cells = useMemo(() => {
    const out: number[] = [];
    for (let m = OPEN_MIN; m < CLOSE_MIN; m += 30) out.push(m);
    return out;
  }, []);

  const canStart = (m: number) =>
    !!courtId && !!date && m > nowMins && m + minutes <= CLOSE_MIN && !overlaps(busy, courtId, date, m, minutes);

  const subtotal = start != null && date ? priceFor(rule, date, start, minutes) : 0;
  const addonsTotal = (catalog.data?.addons ?? []).reduce((s, a) => s + (qty[a.id] ?? 0) * a.price_idr, 0);
  const total = subtotal + addonsTotal;
  const unchanged = !!rb && rb.status === "hold" && courtId === rb.court_id && date === jkt(rb.starts_at).date && start === jkt(rb.starts_at).mins && minutes === (rb.minutes ?? minutes);
  const [needsFix, setNeedsFix] = useState(false);
  const form = useFieldErrors({
    name: () => rules.name(name),
    wa: () => rules.wa(wa),
    email: () => rules.emailOptional(email),
  });

  async function submit() {
    if (start == null || !date || !courtId) return;
    if (!form.check({ name: "book-name", wa: "book-wa", email: "book-email" })) {
      setNeedsFix(true);
      return;
    }
    setErr(null);
    setBusySubmit(true);
    const { data, error } = await supabase.rpc("create_hold", {
      _court: courtId,
      _starts: isoAt(date, start),
      _minutes: minutes,
      _name: name.trim(),
      _wa: normalizeWa(wa) ?? wa,
      _email: email.trim(),
      _addons: Object.entries(qty).filter(([, q]) => q > 0).map(([addon_id, q]) => ({ addon_id, qty: q })),
      _note: note.trim() || undefined,
    });
    setBusySubmit(false);
    if (error || !data) {
      setErr(error?.message ?? "Something went wrong. Try again.");
      qc.invalidateQueries({ queryKey: ["availability", date] });
      return;
    }
    rememberWa(data, normalizeWa(wa) ?? wa);
    navigate({ to: "/booking/$code", params: { code: data } });
  }

  const days = today ? Array.from({ length: 7 }, (_, i) => addDays(today, i)) : [];
  const maxDate = today ? addDays(today, 60) : "";
  // On phones the strip scrolls sideways. Keep the picked day in view (on first load that is Today, not "More dates").
  const dayRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = dayRow.current;
    const tile = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !tile || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: Math.max(0, row.scrollLeft + tile.getBoundingClientRect().left - row.getBoundingClientRect().left - 20), behavior: "instant" as ScrollBehavior });
  }, [date, today]);
  const farDate = date && !days.includes(date) ? date : null;
  const kindAt = (m: number) => {
    if (!courtId || !date) return null;
    const s = new Date(isoAt(date, m)).getTime();
    return busy.find((b) => b.court_id === courtId && new Date(b.starts_at).getTime() < s + 1800000 && new Date(b.ends_at).getTime() > s)?.kind ?? null;
  };

  return (
    <>
      <TopBar />
      <main className="wrap flow">
        <div className="stack-8">
          <div className="book-head">
            <div className="stack-2">
              <Link to="/" className="backlink"><ArrowLeftIcon aria-hidden="true" />Back to home</Link>
              <p className="meta">Padelion Kemang, open every day 06.00 to 23.00</p>
              <h1 className="pds-page-display">Book your court</h1>
            </div>
            <FlowSteps current={0} />
          </div>
          {rb && rb.status === "hold" ? (
            <div className="review-bar" role="status">
              <span className="review-bar__icon" aria-hidden="true"><CheckCircleIcon /></span>
              <div className="review-bar__text">
                <p className="review-bar__t pds-num">You are holding {rb.court}, {dayLabel(jkt(rb.starts_at).date)}, {hm(jkt(rb.starts_at).mins)} to {hm(jkt(rb.ends_at).mins)}</p>
                <p className="t2">Your picks are below. Change anything, or go back and pay. Code {rb.code}.</p>
              </div>
              <Link to="/booking/$code" params={{ code: rb.code }} className="review-bar__back">Back to payment</Link>
            </div>
          ) : null}

          <section className="block" aria-labelledby="day-h">
            <div className="block__head">
              <h2 id="day-h" className="pds-card-title">When do you want to play?</h2>
            </div>
            <div className="day-row" role="group" aria-label="Day" ref={dayRow}>
              {days.map((d, i) => (
                <button key={d} type="button" className="day-tile" aria-pressed={d === date} aria-label={dayLabel(d)} onClick={() => setDate(d)}>
                  <span className="day-tile__w">{i === 0 ? "Today" : dayLabel(d).split(" ")[0].replace(",", "")}</span>
                  <span className="day-tile__d pds-num">{dayLabel(d).split(" ")[1]}</span>
                  <span className="day-tile__m">{dayLabel(d).split(" ")[2]}</span>
                </button>
              ))}
              <button type="button" className="day-tile day-tile--more" aria-pressed={!!farDate} aria-haspopup="dialog" onClick={() => setPickDate(true)}>
                {farDate ? (
                  <>
                    <span className="day-tile__w">{dayLabel(farDate).split(" ")[0]}</span>
                    <span className="day-tile__d pds-num">{dayLabel(farDate).split(" ")[1]}</span>
                    <span className="day-tile__m">{dayLabel(farDate).split(" ")[2]}</span>
                  </>
                ) : (
                  <>
                    <CalendarDaysIcon className="day-tile__icon" aria-hidden="true" />
                    <span className="day-tile__w">More dates</span>
                  </>
                )}
              </button>
            </div>
            {pickDate && today ? <DatePicker value={date} min={today} max={maxDate} onPick={setDate} onClose={() => setPickDate(false)} /> : null}
            <div className="when-sub">
              <span className="pds-label" id="len-h">How long?</span>
              <div className="seg-pill" role="group" aria-labelledby="len-h">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" aria-pressed={d === minutes} onClick={() => setMinutes(d)}>
                    <span className="pds-num">{d} min</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="block" aria-labelledby="court-h">
            <div className="block__head">
              <h2 id="court-h" className="pds-card-title">Choose your court</h2>
            </div>
            <div className="court-grid" role="radiogroup" aria-labelledby="court-h">
              {catalog.data?.courts.map((c) => {
                const r = catalog.data.prices.find((p) => p.court_id === c.id);
                const look = courtLook(c);
                const photo = look.photo;
                const open = avail.data && date
                  ? cells.filter((m) => m > nowMins && m + 60 <= CLOSE_MIN && !overlaps(busy, c.id, date, m, 60)).length
                  : null;
                const selected = c.id === courtId;
                return (
                  <RadioCard
                    key={c.id}
                    selected={selected}
                    onClick={() => setCourtId(c.id)}
                    className={`court-card${open === 0 ? " court-card--full" : ""}`}
                  >
                    <span className="court-card__media">
                      <img src={photo.src} alt={photo.alt} width={1024} height={768} loading="lazy" />
                      {selected && <CheckCircleIcon className="court-card__check" aria-hidden="true" />}
                    </span>
                    <span className="stack-2">
                      <span className="meta">{look.label}</span>
                      <span className="pds-card-title">{c.name}</span>
                      <span className="t2 pds-num">
                        {r ? `From ${money(r.off_peak_idr)} an hour` : ""}
                      </span>
                      <span className="t3 pds-num">
                        {open == null ? "\u00a0" : open === 0 ? (date === today ? "Full today" : "Full this day") : open >= 24 ? "Mostly free" : `${Math.max(1, Math.floor(open / 2))} ${open < 4 ? "hour" : "hours"} free`}
                      </span>
                    </span>
                  </RadioCard>
                );
              })}
            </div>
          </section>

          <section className="block" aria-labelledby="time-h">
            <div className="block__head">
              <h2 id="time-h" className="pds-card-title">Pick your start time</h2>
              <p className="t2">
                {date && isPeak(date, 7 * 60, rule) ? "Peak rates all day." : `Peak rates from ${hm((rule?.weekday_peak_start ?? 17) * 60)}.`}
              </p>
            </div>
            {avail.isLoading || !date ? (
              <p className="t2">Checking open times</p>
            ) : (
              <SlotGrid>
                {cells.map((m) => {
                  const inSel = start != null && m >= start && m < start + minutes;
                  const isEnd = start != null && m === start + minutes - 30;
                  const taken = !!courtId && overlaps(busy, courtId, date, m, 30);
                  const past = m <= nowMins;
                  const startable = canStart(m);
                  const kind = taken ? kindAt(m) : null;
                  const blocked = kind === "blocked" || kind === "demo-league" || kind === "demo-coaching";
                  const held = kind === "demo-hold";
                  const peak = !taken && !past && isPeak(date, m, rule);
                  const label = kind === "demo-league" ? "League" : kind === "demo-coaching" ? "Coaching" : kind === "blocked" ? "Blocked" : held ? "On hold" : taken ? "Taken" : hm(m);
                  const variant = inSel ? undefined : blocked ? "slot-blocked" : held ? "slot-held" : taken ? "slot-taken" : peak ? "slot-peak" : undefined;
                  // Taken and held stay tappable (they open the waitlist), so they are drawn as variants of "open".
                  const state = inSel ? (isEnd ? "range-end" : "selected") : "open";
                  return (
                    <Slot
                      key={m}
                      time={label}
                      className={variant}
                      state={state}
                      endLabel={`to ${hm(start! + minutes)}`}
                      disabled={!inSel && (past || blocked || (!taken && !startable))}
                      aria-label={blocked ? `${hm(m)}, ${label.toLowerCase()}` : held ? `${hm(m)} on hold, join the waitlist` : taken ? `${hm(m)} taken` : `Start at ${hm(m)}${peak ? ", peak rate" : ""}`}
                      onClick={() => {
                        if (taken && !blocked) { setWaitTap(m); return; }
                        setWaitTap(null);
                        if (startable) setStart(m);
                      }}
                    />
                  );
                })}
              </SlotGrid>
            )}
            <ul className="slot-legend" aria-hidden="true">
              <li><span className="lg lg--open" />Open</li>
              <li><span className="lg lg--peak" />Peak rate</li>
              <li><span className="lg lg--pick" />Your time</li>
              <li><span className="lg lg--held" />On hold, may free up</li>
              <li><span className="lg lg--taken" />Taken, tap for the waitlist</li>
              <li><span className="lg lg--block" />League or coaching</li>
            </ul>
            {waitTap != null && court && date ? (
              <p className="t2 pds-num" aria-live="polite">
                {court.name}, {hm(waitTap)} is {kindAt(waitTap) === "demo-hold" ? "on hold for someone else and may free up" : "taken"}.{" "}
                <button type="button" className="textbtn" onClick={() => setWaitOpen(true)}>Join waitlist</button>
              </p>
            ) : null}
            {waitOpen && waitTap != null && court && date ? (
              <WaitlistSheet
                title={`${court.name}, ${dayLabel(date)}, ${hm(waitTap)}`}
                courtId={court.id}
                startsAt={isoAt(date, waitTap)}
                offerMin={settings.data?.offer_minutes ?? 15}
                initialName={name}
                initialWa={wa}
                onClose={() => setWaitOpen(false)}
              />
            ) : null}
          </section>

          <section className="block" aria-labelledby="add-h">
            <div className="block__head">
              <p className="meta">Optional</p>
              <h2 id="add-h" className="pds-card-title">Add rackets, balls or a towel</h2>
            </div>
            <div className="addon-pick-list">
              {catalog.data?.addons.map((a) => {
                const q = qty[a.id] ?? 0;
                const note = addonNote(a.name);
                return (
                  <div className={`addon-pick${q > 0 ? " addon-pick--on" : ""}`} key={a.id}>
                    <AddonThumb name={a.name} />
                    <div className="addon-pick__text">
                      <span className="pds-label">{a.name}</span>
                      {note ? <span className="t3">{note}</span> : null}
                      <span className="t2 pds-num">{money(a.price_idr)}</span>
                    </div>
                    <div className="stepper">
                      <button type="button" aria-label={`Remove one ${a.name}`} disabled={q === 0} onClick={() => setQty({ ...qty, [a.id]: q - 1 })}>
                        <MinusIcon className="icon-sm" aria-hidden="true" />
                      </button>
                      <span className="pds-num pds-label" aria-live="polite">{q}</span>
                      <button type="button" aria-label={`Add one ${a.name}`} disabled={q >= 8} onClick={() => setQty({ ...qty, [a.id]: q + 1 })}>
                        <PlusIcon className="icon-sm" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="block" aria-labelledby="you-h">
            <div className="block__head">
              <h2 id="you-h" className="pds-card-title">Who is booking?</h2>
            </div>
            <div className="book-fields">
              <Input id="book-name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={50} error={form.error("name")} {...form.blur("name")} />
              <PhoneField id="book-wa" hint="Your ticket and reminders go here." value={wa} onChange={setWa} error={form.error("wa")} {...form.blur("wa")} />
              <Input id="book-email" label="Email, optional" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={64} error={form.error("email")} {...form.blur("email")} />
              <div className="pds-field book-note">
                <label className="pds-field__label" htmlFor="book-note">Anything the desk should know? <span className="t3">Optional</span></label>
                <textarea id="book-note" className="pds-input book-note__input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A birthday game, a left-handed racket, a coach for the first 30 minutes" aria-describedby="book-note-count" />
                <span id="book-note-count" className="pds-field__hint pds-num book-note__count">{note.length} / 300</span>
              </div>
            </div>
          </section>

          <div className="book-bar" role="region" aria-label="Hold your court">
            {err ? <p className="notice notice--error book-bar__msg" role="alert">{err}</p> : null}
            {needsFix && !form.valid ? <p className="notice notice--error book-bar__msg" role="alert">Check your details above, then hold the court.</p> : null}
            <div className="book-bar__row">
              <div className="book-bar__sum">
                <p className="book-bar__what pds-num">
                  {start != null && date && court ? `${court.name}, ${dayLabel(date)}, ${hm(start)} to ${hm(start + minutes)}` : "Pick a day, a court and a start time"}
                </p>
                <p className="book-bar__total pds-num">{start != null ? money(total) : "\u00a0"}</p>
              </div>
              {unchanged ? (
                <Button className="book-bar__cta" onClick={() => navigate({ to: "/booking/$code", params: { code: rb!.code } })}>Back to payment</Button>
              ) : (
                <Button className="book-bar__cta" disabled={start == null || busySubmit} onClick={submit}>
                  {busySubmit ? "Holding your court" : start == null ? "Pick a start time" : rb ? "Hold this new time" : `Hold my court for ${settings.data?.hold_minutes ?? 15} min`}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="flow__aside">
          <Card surface="public" className="sum-card">
            <p className="meta">Your booking</p>
            <div className="stack-2">
              <p className="sum-card__title">{court?.name ?? "Pick a court"}</p>
              <p className="sum-card__line pds-num">
                <CalendarDaysIcon aria-hidden="true" />
                {date ? dayLabel(date) : "Pick a day"}
                {start != null ? `, ${hm(start)} to ${hm(start + minutes)}` : ""}
              </p>
              <p className="sum-card__line">
                <MapPinIcon aria-hidden="true" />
                Jl. Kemang Raya, South Jakarta
              </p>
            </div>
            <hr className="divider" />
            {start != null && date ? (
              <>
                <div className="stack-3">
                  <div className="sum-line">
                    <span className="t2">Court, {minutes} min, {isPeak(date, start, rule) ? "peak" : "off-peak"}</span>
                    <span className="pds-num">{money(subtotal)}</span>
                  </div>
                  {catalog.data?.addons.filter((a) => (qty[a.id] ?? 0) > 0).map((a) => (
                    <div className="sum-line" key={a.id}>
                      <span className="t2">{qty[a.id]} × {a.name}</span>
                      <span className="pds-num">{money(qty[a.id]! * a.price_idr)}</span>
                    </div>
                  ))}
                  <div className="sum-line sum-line--total">
                    <span>Total</span>
                    <span className="pds-num">{money(total)}</span>
                  </div>
                  <div className="sum-line sum-line--split">
                    <span>Split between 4 players</span>
                    <span className="pds-num">{money(total / 4)} each</span>
                  </div>
                </div>
                <p className="sum-card__note pds-num">
                  Pay {settings.data?.deposit_pct ?? 50}% now, {money((total * (settings.data?.deposit_pct ?? 50)) / 100)}, or the full amount. The rest is due {settings.data?.balance_hours ?? 2} hours before you play.
                </p>
              </>
            ) : (
              <p className="sum-card__note">
                Pick a start time and your price shows here. You pay {settings.data?.deposit_pct ?? 50}% now or the full amount, no account needed.
              </p>
            )}
            <p className="sum-card__foot">Free reschedule up to {settings.data?.reschedule_hours ?? 12} hours before you play.</p>
          </Card>
        </aside>
      </main>
    </>
  );
}
