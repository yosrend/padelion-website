import { useEffect, useRef, useState } from "react";
import { CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { Button, Input } from "@/design-system/padelion";
import { PhoneField } from "@/components/player/PhoneField";
import { photos } from "@/lib/landing-photos";
import { rules, useFieldErrors } from "@/lib/validate";
import { useMoney } from "@/lib/currency";

const SHOTS = [
  { ...photos.cta, cap: "The dome at dusk", where: "From above", cls: "gal__item--wide" },
  { ...photos.courtGreen, cap: "Court 3, the center court", where: "Neon green, glass all round", cls: "gal__item--tall" },
  { ...photos.reschedule, cap: "A Friday doubles rally", where: "Court 2", cls: "gal__item--tall" },
  { ...photos.reminder, cap: "The front desk", where: "Rackets, balls and cold water", cls: "" },
  { ...photos.waitlist, cap: "Walking in for the 20.00", where: "Main entrance", cls: "" },
  { ...photos.courtBlue, cap: "Court 1 under the dome", where: "Blue, tempered glass", cls: "gal__item--wide" },
  { ...photos.visit, cap: "The entrance on Kemang Raya", where: "Free parking for 20 cars", cls: "gal__item--wide" },
];

/** Gallery: a bento of the venue, each photo opens full size with arrows and Esc. */
export function GallerySection() {
  const [open, setOpen] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  const step = (n: number) => setOpen((o) => (o === null ? o : (o + n + SHOTS.length) % SHOTS.length));
  const cur = open !== null ? SHOTS[open] : null;

  return (
    <section id="gallery" className="section wrap gal">
      <div className="gal__head">
        <h2 className="pds-section-title rise">Inside the dome</h2>
        <p className="body-lg">Three glass courts under one roof in Kemang. Dry in the rain, cool after dark.</p>
      </div>
      <ul className="gal__grid">
        {SHOTS.map((s, i) => (
          <li key={s.cap} className={`gal__item ${s.cls}`}>
            <button type="button" className="gal__btn" onClick={() => setOpen(i)} aria-label={`Open photo: ${s.cap}`}>
              <img src={s.src} alt={s.alt} loading="lazy" />
              <span className="gal__cap"><strong>{s.cap}</strong><span>{s.where}</span></span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dlg}
        className="gal__dlg"
        aria-label="Photo"
        onClose={() => setOpen(null)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }}
      >
        {cur ? (
          <figure className="gal__fig">
            <img key={cur.cap} src={cur.src} alt={cur.alt} />
            <figcaption><strong>{cur.cap}</strong> <span>{cur.where}</span> <span className="pds-num gal__count">{(open ?? 0) + 1} of {SHOTS.length}</span></figcaption>
          </figure>
        ) : null}
        <button type="button" className="gal__nav gal__nav--prev" onClick={() => step(-1)} aria-label="Previous photo"><ChevronLeftIcon /></button>
        <button type="button" className="gal__nav gal__nav--next" onClick={() => step(1)} aria-label="Next photo"><ChevronRightIcon /></button>
        <button type="button" className="gal__close" onClick={() => setOpen(null)} aria-label="Close"><XMarkIcon /></button>
      </dialog>
    </section>
  );
}

type Plan = "social" | "club";

/** Club membership: two plans, a short join form and a member card that fills in as you type. */
export function MembershipSection() {
  const money = useMoney();
  const [plan, setPlan] = useState<Plan>("club");
  const [name, setName] = useState("");
  const [wa, setWa] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useFieldErrors({ name: () => rules.name(name), wa: () => rules.wa(wa) });

  const plans: { id: Plan; name: string; price: number; perks: string[] }[] = [
    { id: "social", name: "Social", price: 250000, perks: ["Book 7 days before everyone else", "10% off every court hour", "Free racket rental on weekdays"] },
    { id: "club", name: "Club", price: 650000, perks: ["Book 14 days ahead", "20% off every court hour", "Two free off-peak hours a month", "Free towels, rackets and balls", "Monday night club ladder"] },
  ];
  const p = plans.find((x) => x.id === plan)!;
  const memberNo = "PDL-M-" + String(1000 + (name.length * 37 + wa.replace(/\D/g, "").slice(-3).length * 101) % 9000).padStart(4, "0");

  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!form.check({ name: "club-name", wa: "club-wa" })) return;
    setBusy(true);
    window.setTimeout(() => { setBusy(false); setDone(true); }, 900);
  }

  return (
    <section id="club" className="section wrap club">
      <div className="club__intro">
        <h2 className="pds-section-title rise">Play every week? Join the club.</h2>
        <p className="body-lg">Book further ahead, pay less per hour and meet players at your level on the Monday ladder.</p>

        <div className="club__plans" role="radiogroup" aria-label="Plan">
          {plans.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={plan === x.id} className={`club__plan${plan === x.id ? " club__plan--on" : ""}`} onClick={() => setPlan(x.id)} disabled={done}>
              <span className="club__plan-top">
                <span className="club__plan-name">{x.name}</span>
                {x.id === "club" ? <span className="club__badge">Most players pick this</span> : null}
              </span>
              <span className="club__plan-price pds-num">{money(x.price)}<span> a month</span></span>
              <ul className="club__perks">
                {x.perks.map((k) => <li key={k}><CheckIcon aria-hidden="true" />{k}</li>)}
              </ul>
            </button>
          ))}
        </div>
      </div>

      <div className="club__side">
        <div className={`mcard${plan === "club" ? " mcard--club" : ""}${done ? " mcard--done" : ""}`} aria-hidden="true">
          <div className="mcard__top">
            <img src="/padelion-mark.svg" alt="" width={28} height={28} />
            <span>Padelion {p.name}</span>
          </div>
          <svg className="mcard__court" viewBox="0 0 200 100" aria-hidden="true"><rect x="1" y="1" width="198" height="98" rx="2" /><path d="M100 1v98M30 1v98M170 1v98M30 50h140" /></svg>
          <p className="mcard__since pds-num">{p.name === "Club" ? "20% off every hour" : "10% off every hour"}</p>
          <p className="mcard__name">{name.trim() || "Your name"}</p>
          <div className="mcard__foot pds-num">
            <span>{done ? memberNo : "PDL-M-0000"}</span>
            <span>Kemang</span>
          </div>
        </div>

        {done ? (
          <div className="club__done" role="status">
            <span className="club__done-tick"><CheckIcon aria-hidden="true" /></span>
            <p className="pds-card-title">Welcome to the club, {name.trim().split(" ")[0]}.</p>
            <p className="t2 pds-num">Your {p.name} card is on its way to WhatsApp. Member prices apply from your next booking. This is a demo, nothing is charged.</p>
            <Button variant="secondary" onClick={() => { setDone(false); setName(""); setWa(""); form.reset(); }}>Start over</Button>
          </div>
        ) : (
          <form className="club__form" onSubmit={join} noValidate>
            <Input id="club-name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} autoComplete="name" error={form.error("name")} {...form.blur("name")} />
            <PhoneField id="club-wa" value={wa} onChange={setWa} error={form.error("wa")} {...form.blur("wa")} />
            <Button type="submit" className="full" disabled={busy}>{busy ? "Joining" : `Join ${p.name} for ${money(p.price)} a month`}</Button>
            <p className="t3">Cancel any time from WhatsApp. Demo only, nothing is charged.</p>
          </form>
        )}
      </div>
    </section>
  );
}
