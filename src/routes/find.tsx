import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneField } from "@/components/player/PhoneField";
import { useEffect, useState } from "react";
import { Button, Chip, Input } from "@/design-system/padelion";
import { SiteFooter, TopBar } from "@/components/SiteChrome";
import { ArrowPathIcon, BanknotesIcon, ChatBubbleOvalLeftEllipsisIcon, QrCodeIcon, ShareIcon, TicketIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { photos } from "@/lib/landing-photos";
import { supabase } from "@/integrations/supabase/client";
import { dayLabel, idr, jkt, maskWa, rememberWa, statusCopy, timeLabel, type BookingView } from "@/lib/padel";

import { normalizeWa, rules, useFieldErrors } from "@/lib/validate";
import { useMoney } from "@/lib/currency";
export const Route = createFileRoute("/find")({
  head: () => ({
    meta: [
      { title: "Find your booking at Padelion" },
      { name: "description", content: "See all your Padelion bookings and waitlist offers with your WhatsApp number." },
      { property: "og:title", content: "Find your booking at Padelion" },
      { property: "og:description", content: "See all your Padelion bookings and waitlist offers with your WhatsApp number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FindPage,
});

type Row = { code: string; court: string; starts_at: string; ends_at: string; status: BookingView["status"]; total_idr: number; paid_idr: number; balance_due_at: string | null };
type OfferRow = { id: string; court: string; starts_at: string; offer_expires_at: string };
type Result = { bookings: Row[]; offers: OfferRow[] };

const tone = (s: Row["status"]) => (s === "paid" || s === "played" ? "paid" : s === "deposit_paid" ? "balance" : s === "hold" ? "hold" : "urgent") as "paid" | "balance" | "hold" | "urgent";

function FindPage() {
  const money = useMoney();
  const navigate = useNavigate();
  const [wa, setWa] = useState("");
  const [step, setStep] = useState<"wa" | "otp" | "list">("wa");
  const [otp, setOtp] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const digits = wa.replace(/\D/g, "");
  const waForm = useFieldErrors({ wa: () => rules.wa(wa) });
  const otpForm = useFieldErrors({ otp: () => rules.otp(otp) });

  async function verify() {
    if (!otpForm.check({ otp: "find-otp" })) return;
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("find_bookings", { _wa: normalizeWa(wa) ?? wa, _otp: otp });
    setBusy(false);
    if (error) return setErr(error.message);
    const r = data as unknown as Result;
    r.bookings.forEach((b) => rememberWa(b.code, wa));
    setRes(r);
    setStep("list");
  }

  const open = (code: string) => navigate({ to: "/booking/$code", params: { code } });
  const due = (res?.bookings ?? []).filter((b) => b.status === "deposit_paid" && b.total_idr > b.paid_idr && now != null && new Date(b.ends_at).getTime() > now);

  return (
    <>
      <TopBar />
      <main className="wrap section">
        {step !== "list" ? (
          <>
          <div className="findx">
            <div className="findx__main">
              <div className="stack-4">
                <p className="meta">No account needed</p>
                <h1 className="pds-display">Find your booking</h1>
                <p className="body-lg">Enter the WhatsApp number you booked with. We send you a one-time code, then show every game on that number.</p>
              </div>
              <div className="findx__card">
                <ol className="findx__steps" aria-label="Steps">
                  <li className={step === "wa" ? "is-now" : "is-done"}><span className="pds-num">{step === "wa" ? "1" : "✓"}</span>Your number</li>
                  <li className={step === "otp" ? "is-now" : ""}><span className="pds-num">2</span>One-time code</li>
                  <li><span className="pds-num">3</span>Your bookings</li>
                </ol>
            {step === "wa" ? (
              <form className="stack-4" onSubmit={(e) => { e.preventDefault(); if (waForm.check({ wa: "find-wa" })) { setErr(null); setStep("otp"); } }}>
                <PhoneField id="find-wa" value={wa} onChange={setWa} error={waForm.error("wa")} {...waForm.blur("wa")} />
                <div><Button type="submit">Send me a code</Button></div>
              </form>
            ) : (
              <form className="stack-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <p className="hold-box pds-num">Demo code: {digits.slice(-4)}. Demo only. A real WhatsApp code replaces this at launch.</p>
                <Input id="find-otp" label="One-time code" error={otpForm.error("otp")} {...otpForm.blur("otp")} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={4} />
                {err ? <p className="notice notice--error" role="alert">{err}</p> : null}
                <div className="row">
                  <Button type="submit" disabled={busy}>{busy ? "Checking" : "Show my bookings"}</Button>
                  <button type="button" className="textbtn" onClick={() => { setStep("wa"); setOtp(""); otpForm.reset(); }}>Change number</button>
                </div>
              </form>
            )}
              </div>
              <p className="t3">We only use your number for your bookings and reminders.</p>
            </div>

            <aside className="findx__art">
              <img src={photos.waitlist.src} alt={photos.waitlist.alt} loading="lazy" />
              <div className="findx__shade" aria-hidden="true" />
              <div className="findx__glass">
                <p className="findx__glass-t">From your booking you can</p>
                <ul>
                  <li><BanknotesIcon aria-hidden="true" /><span><strong>Pay the balance</strong>Online, before you arrive</span></li>
                  <li><ArrowPathIcon aria-hidden="true" /><span><strong>Move your game</strong>Free up to 12 hours before</span></li>
                  <li><ShareIcon aria-hidden="true" /><span><strong>Send the ticket</strong>To your group, as an image</span></li>
                  <li><QrCodeIcon aria-hidden="true" /><span><strong>Check in by QR</strong>At the desk or by your court</span></li>
                </ul>
              </div>
            </aside>
          </div>

          <ul className="findx__help">
            <li>
              <TicketIcon aria-hidden="true" />
              <p className="pds-label">Have your code?</p>
              <form className="findx__code" onSubmit={(e) => { e.preventDefault(); const d = (new FormData(e.currentTarget).get("code") as string).replace(/\D/g, ""); if (d) open(`PDL-${d.padStart(4, "0")}`); }}>
                <span className="findx__pre">PDL-</span>
                <input name="code" inputMode="numeric" maxLength={6} placeholder="2048" aria-label="Booking code digits" />
                <button type="submit">Open</button>
              </form>
            </li>
            <li>
              <UserGroupIcon aria-hidden="true" />
              <p className="pds-label">Booked by a friend?</p>
              <p className="t2">Use the number on the booking. The ticket and reminders went there, so ask them to share the ticket image.</p>
            </li>
            <li>
              <ChatBubbleOvalLeftEllipsisIcon aria-hidden="true" />
              <p className="pds-label">Changed your number?</p>
              <p className="t2">Message the desk with your name and game time from the chat in the corner. <Link to="/book" className="textlink">Or book a new court</Link>.</p>
            </li>
          </ul>
          </>
        ) : (
          <div className="stack-8">
            <div className="stack-3">
              <p className="meta">Find my booking</p>
              <h1 className="pds-section-title pds-num">Bookings for {maskWa(wa)}</h1>
            </div>
            <div className="need-grid">
              <section className="stack-4" aria-labelledby="need-h">
                <h2 id="need-h" className="pds-card-title">Needs you</h2>
                {res!.offers.length === 0 && due.length === 0 ? <p className="t2">Nothing to do right now.</p> : null}
                {res!.offers.map((o) => (
                  <div key={o.id} className="stack-2 bk-row bk-row--col">
                    <p className="meta">Waitlist offer</p>
                    <p className="pds-label pds-num">{o.court}, {dayLabel(jkt(o.starts_at).date)}, {timeLabel(o.starts_at)}</p>
                    <p className="t2 pds-num">Held for you until {timeLabel(o.offer_expires_at)}</p>
                    <Link to="/offer/$id" params={{ id: o.id }} className="textlink">See the offer</Link>
                  </div>
                ))}
                {due.map((b) => (
                  <div key={b.code} className="stack-2 bk-row bk-row--col">
                    <p className="meta pds-num">{b.code}, balance due</p>
                    <p className="pds-label pds-num">{b.court}, {dayLabel(jkt(b.starts_at).date)}, {timeLabel(b.starts_at)}</p>
                    <p className="t2 pds-num">{money(b.total_idr - b.paid_idr)} left to pay</p>
                    <Button variant="selection" onClick={() => open(b.code)}>Pay balance</Button>
                  </div>
                ))}
              </section>
              <section className="stack-2" aria-labelledby="list-h">
                <h2 id="list-h" className="pds-card-title">Coming up and played</h2>
                {res!.bookings.length === 0 ? <p className="t2">No bookings on this number yet. <Link to="/book" className="textlink">Book a court</Link></p> : null}
                {res!.bookings.map((b) => (
                  <Link key={b.code} to="/booking/$code" params={{ code: b.code }} className="bk-row">
                    <div className="stack-1">
                      <p className="meta pds-num">{b.code}</p>
                      <p className="pds-label pds-num">{b.court}, {dayLabel(jkt(b.starts_at).date)}</p>
                      <p className="t2 pds-num">{timeLabel(b.starts_at)} to {timeLabel(b.ends_at)}</p>
                    </div>
                    <Chip tone={tone(b.status)}>{statusCopy(b.status)}</Chip>
                  </Link>
                ))}
              </section>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
