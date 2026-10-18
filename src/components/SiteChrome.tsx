import { ChatWidget } from "@/components/ChatWidget";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bars2Icon, XMarkIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { setCurrency, useCurrency, IDR_PER_USD, type Currency } from "@/lib/currency";
import { usePageMotion } from "@/components/motion";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/#courts", label: "Courts" },
  { href: "/#prices", label: "Prices" },
  { href: "/#visit", label: "Visit" },
];

function Brand() {
  return (
    <Link to="/" className="brand row" aria-label="Padelion, home">
      <Logo className="brand__logo" />
    </Link>
  );
}

export function CurrencySwitch({ tone = "light" }: { tone?: "light" | "dark" }) {
  const c = useCurrency();
  const opts: Currency[] = ["IDR", "USD"];
  return (
    <div className={`cur cur--${tone}`} role="group" aria-label="Show prices in">
      {opts.map((o) => (
        <button key={o} type="button" aria-pressed={c === o} onClick={() => setCurrency(o)} className="cur__opt">
          {o}
        </button>
      ))}
    </div>
  );
}

/**
 * The one menu bar for every player page.
 * over: floats on the landing hero as liquid glass, then turns into a darker glass once you scroll,
 * so it stays readable over white sections. page: a light bar for booking and ticket pages.
 */
export function SiteNav({ over = false }: { over?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  usePageMotion(path);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const tone = over ? "dark" : "light";
  return (
    <header className={`snav ${over ? "snav--over" : "snav--page"}${scrolled ? " snav--scrolled" : ""}`}>
      <div className={`snav__bar${over ? " pds-glass" : ""}`}>
        <Brand />
        <nav className="snav__links" aria-label="Main">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>{l.label}</a>
          ))}
          <Link to="/find" activeProps={{ "aria-current": "page" }}>Find my booking</Link>
        </nav>
        <div className="snav__end">
          <CurrencySwitch tone={over ? "dark" : "light"} />
          <Link to="/book" className="snav__cta">Book a court</Link>
          <button type="button" className={`snav__menu snav__menu--${tone}`} aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Bars2Icon aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <div className="msheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="msheet__top">
            <Brand />
            <button type="button" className="snav__menu snav__menu--dark" aria-label="Close menu" onClick={() => setOpen(false)}>
              <XMarkIcon aria-hidden="true" />
            </button>
          </div>
          <nav className="msheet__links" aria-label="Menu">
            <Link to="/book">Book a court</Link>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>
            ))}
            <Link to="/find">Find my booking</Link>
          </nav>
          <div className="msheet__foot">
            <div className="stack-2">
              <p className="msheet__label">Show prices in</p>
              <CurrencySwitch tone="dark" />
              <p className="msheet__note">You always pay in rupiah. Dollar prices use Rp {IDR_PER_USD.toLocaleString("id-ID")} per US$1.</p>
            </div>
            <Link to="/demo" className="msheet__demo">Demo tour <ArrowUpRightIcon aria-hidden="true" /></Link>
          </div>
        </div>
      ) : null}

      {/* Phones: the booking button lives in its own bar at the bottom, in thumb reach */}
      {!path.startsWith("/book") && !open ? (
        <div className="fab-book">
          <Link to="/book" className="fab-book__btn">
            Book a court <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </header>
  );
}

/** Kept for the pages that import it. */
export function TopBar() {
  return <SiteNav />;
}

export function SiteFooter() {
  return (
    <>
    <ChatWidget />
    <footer className="footer">
      <div className="footer__inner wrap">
        <div className="footer__grid" data-stagger>
          <div className="stack-4 footer__lead">
            <p className="footer__title">Three courts in Kemang. Book in a minute, play tonight.</p>
            <Link to="/book" className="footer__cta">Book a court <ArrowUpRightIcon aria-hidden="true" /></Link>
          </div>
          <div className="stack-2">
            <p className="footer__label">Visit</p>
            <p>Jl. Kemang Raya, South Jakarta</p>
            <p className="pds-num">Every day, 06.00 to 23.00</p>
            <p>Free parking for 20 cars</p>
          </div>
          <div className="stack-2">
            <p className="footer__label">Your booking</p>
            <Link to="/book">Book a court</Link>
            <Link to="/find">Find my booking</Link>
            <a href="/#prices">Prices</a>
          </div>
          <div className="stack-2">
            <p className="footer__label">Venue</p>
            <Link to="/staff/login">Staff sign in</Link>
            <Link to="/demo">Demo tour</Link>
            <CurrencySwitch tone="light" />
          </div>
        </div>
        <div className="footer__bar">
          <p>© 2026 Padelion. A demo venue. Payments and messages are simulated.</p>
          <p>Payments and WhatsApp messages are simulated.</p>
        </div>
      </div>
      <div className="footer__giant" aria-hidden="true" data-giant>
        {/* SVG text stretched to the exact page width, so the wordmark always fills it edge to edge */}
        <svg viewBox="0 0 1000 188" preserveAspectRatio="xMidYMax meet">
          <text x="0" y="188" textLength="1000" lengthAdjust="spacingAndGlyphs">Padelion</text>
        </svg>
      </div>
    </footer>
    </>
  );
}

const STEPS = ["Time and court", "Details and pay", "Ticket"];

/**
 * Where the player is in the booking: time and court, then details and pay, then the ticket.
 * Finished steps show a tick and, when the page allows it, take the player back to check that step.
 */
export function FlowSteps({ current, onStep }: { current: number; onStep?: (i: number) => void }) {
  return (
    <ol className="fsteps" aria-label="Booking steps">
      {STEPS.map((s, i) => {
        const done = i < current;
        const inner = (
          <>
            <span className="fsteps__n pds-num" aria-hidden="true">
              {done ? <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}
            </span>
            <span className="fsteps__label">{s}</span>
            {done ? <span className="sr-only">, done</span> : null}
          </>
        );
        return (
          <li key={s} className={i === current ? "fsteps__on" : done ? "fsteps__done" : "fsteps__next"} aria-current={i === current ? "step" : undefined}>
            {done && onStep ? (
              <button type="button" className="fsteps__btn" onClick={() => onStep(i)} title={`Back to ${s.toLowerCase()}`}>{inner}</button>
            ) : (
              <span className="fsteps__btn">{inner}</span>
            )}
            {i < STEPS.length - 1 ? <span className={`fsteps__bar${done ? " fsteps__bar--done" : ""}${i === current - 1 ? " fsteps__bar--now" : ""}`} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
