import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { ArrowPathIcon, BellAlertIcon, CloudIcon, UserPlusIcon } from "@heroicons/react/24/outline";
import { useMoney } from "@/lib/currency";

type Msg = { me?: boolean; text: string; at: string; buttons?: string[] };
type Scene = { id: string; icon: ComponentType<SVGProps<SVGSVGElement>>; when: string; title: string; desc: string; msgs: Msg[] };

const STEP_MS = 1100;
const HOLD_MS = 3600;

function scenes(money: (n: number) => string): Scene[] {
  return [
    {
      id: "reminder",
      when: "The night before",
      icon: BellAlertIcon,
      title: "A reminder before you play",
      desc: "And again two hours out, with the balance link inside.",
      msgs: [
        { text: "Hi Dimas, see you tonight. Court 2, 20.00 to 21.30.", at: "18.02" },
        { text: `The balance is ${money(262500)}. Pay it here and walk straight on court.`, at: "18.02", buttons: ["Pay balance"] },
        { me: true, text: "Paid", at: "18.05" },
        { text: "All set. Show PDL-2048 at the desk when you arrive.", at: "18.05" },
      ],
    },
    {
      id: "rain",
      when: "Before you leave home",
      icon: CloudIcon,
      title: "A rain plan, sent before you leave",
      desc: "The dome keeps the courts dry. When Kemang Raya floods, you move later in one tap.",
      msgs: [
        { text: "Heavy rain over Kemang from 19.00. The courts stay dry, the road outside may not.", at: "17.10" },
        { text: "Want to move to 21.00 instead? No fee.", at: "17.10", buttons: ["Move to 21.00", "Keep 20.00"] },
        { me: true, text: "Move to 21.00", at: "17.12" },
        { text: "Done. Court 2 at 21.00, same code PDL-2048.", at: "17.12" },
      ],
    },
    {
      id: "waitlist",
      when: "When a court frees up",
      icon: UserPlusIcon,
      title: "First dibs when a court frees up",
      desc: "If someone misses their deposit, the time goes to the waitlist before anyone else.",
      msgs: [
        { text: "Court 1 at 21.00 just opened up. We are holding it for you for 15 minutes.", at: "20.42", buttons: ["Take it"] },
        { me: true, text: "Take it", at: "20.43" },
        { text: `It is yours. Pay the ${money(262500)} deposit to lock it in.`, at: "20.43" },
      ],
    },
    {
      id: "move",
      when: "Up to 12 hours before",
      icon: ArrowPathIcon,
      title: "Plans change, the booking follows",
      desc: "Move your game from the ticket, free up to 12 hours before you play.",
      msgs: [
        { text: "Your game moved to Sunday 09.00 on Court 2.", at: "09.15" },
        { text: "Same code, PDL-2048. No fee, you moved it more than 12 hours ahead.", at: "09.15", buttons: ["View ticket"] },
      ],
    },
  ];
}

function StatusIcons() {
  return (
    <svg className="iphone__icons" viewBox="0 0 68 12" aria-hidden="true">
      <rect x="0" y="7" width="3" height="5" rx="1" />
      <rect x="5" y="5" width="3" height="7" rx="1" />
      <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
      <rect x="15" y="0" width="3" height="12" rx="1" />
      <path d="M31 3.2a9 9 0 0 1 12 0l-1.4 1.5a7 7 0 0 0-9.2 0zM33.6 6a5.3 5.3 0 0 1 6.8 0L39 7.5a3.3 3.3 0 0 0-4 0zM37 11.4l-1.9-1.9a2.7 2.7 0 0 1 3.8 0z" />
      <rect x="47.5" y="0.5" width="18" height="11" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <rect x="49.5" y="2.5" width="14" height="7" rx="1.6" />
      <rect x="66.3" y="4" width="1.4" height="4" rx="0.7" fillOpacity="0.45" />
    </svg>
  );
}

/**
 * After booking: an iPhone with the venue's WhatsApp thread. Each moment on the right
 * plays its own short conversation, so a visitor sees exactly what lands on their phone.
 */
/** How long a scene plays before the next one, so the timeline can show its progress. */
function sceneMs(sc: Scene) {
  let t = 250;
  sc.msgs.forEach((m, i) => { if (i > 0 && !m.me) t += 750; t += STEP_MS; });
  return t + HOLD_MS;
}

export function UpdatesChat({ head }: { head?: ReactNode }) {
  const money = useMoney();
  const list = scenes(money);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [auto, setAuto] = useState(true);
  const [inView, setInView] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);
  const scene = list[active];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Play the thread one message at a time, with a typing beat before each reply from the venue.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(scene.msgs.length);
      return;
    }
    if (!inView) return;
    setShown(0);
    setTyping(false);
    const timers: number[] = [];
    let t = 250;
    scene.msgs.forEach((m, i) => {
      if (i > 0 && !m.me) {
        timers.push(window.setTimeout(() => setTyping(true), t));
        t += 750;
      }
      timers.push(window.setTimeout(() => { setTyping(false); setShown(i + 1); }, t));
      t += STEP_MS;
    });
    if (auto) timers.push(window.setTimeout(() => setActive((a) => (a + 1) % list.length), t + HOLD_MS));
    return () => timers.forEach(clearTimeout);
  }, [active, inView, auto]);

  useEffect(() => {
    const c = chat.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
  }, [shown, typing]);

  return (
    <div className="uchat" ref={root}>
      <div className="iphone" aria-label={`WhatsApp from Padelion: ${scene.title}`} role="img">
        <div className="iphone__screen">
          <div className="iphone__status">
            <span className="pds-num">9:41</span>
            <span className="iphone__island" aria-hidden="true" />
            <StatusIcons />
          </div>
          <div className="wa__head">
            <svg className="wa__back" viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <img className="wa__avatar" src="/padelion-mark.svg" alt="" width={36} height={36} />
            <div className="wa__who">
              <p className="wa__name">Padelion Kemang
                <svg viewBox="0 0 24 24" aria-hidden="true" className="wa__tick"><path d="M12 1.5l2.4 1.9 3-.3 1 2.9 2.7 1.4-.6 3 1.6 2.6-2.2 2.1-.1 3.1-3 .6-1.8 2.5-2.9-1.1-2.9 1.1-1.8-2.5-3-.6-.1-3.1L1.9 13l1.6-2.6-.6-3 2.7-1.4 1-2.9 3 .3z" /><path d="m8 12.3 2.6 2.6L16.2 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </p>
              <p className="wa__sub">Business account</p>
            </div>
          </div>
          <div className="wa__chat" ref={chat} aria-live="polite">
            <span className="wa__day">Today</span>
            {scene.msgs.slice(0, shown).map((m, i) => (
              <div key={`${scene.id}-${i}`} className={`wa__msg${m.me ? " wa__msg--me" : ""}`}>
                <div className="wa__bubble">
                  <p>{m.text}</p>
                  <span className="wa__at pds-num">{m.at}{m.me ? <svg viewBox="0 0 18 11" aria-hidden="true" className="wa__read"><path d="M1 6l3.5 3.5L12 2M7 9.5 14.5 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}</span>
                </div>
                {m.buttons ? (
                  <div className="wa__btns">
                    {m.buttons.map((b) => <span key={b} className="wa__btn">{b}</span>)}
                  </div>
                ) : null}
              </div>
            ))}
            {typing ? <div className="wa__msg"><div className="wa__bubble wa__typing" aria-label="Padelion is typing"><i /><i /><i /></div></div> : null}
          </div>
          <div className="wa__input" aria-hidden="true">
            <span className="wa__plus">+</span>
            <span className="wa__field" />
            <span className="wa__mic" />
          </div>
        </div>
      </div>

      <div className="uchat__side">
        {head}
        <ol className="utl" role="tablist" aria-label="What lands on your phone">
          {list.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.id} className={`utl__item${on ? " utl__item--on" : ""}${i < active ? " utl__item--past" : ""}`}>
                <span className="utl__rail" aria-hidden="true">
                  <span className="utl__dot"><s.icon /></span>
                  {on && auto && inView ? <span key={`${s.id}-${active}`} className="utl__fill" style={{ animationDuration: `${sceneMs(s)}ms` }} /> : null}
                </span>
                <button type="button" role="tab" aria-selected={on} className="utl__btn" onClick={() => { setAuto(false); setActive(i); }}>
                  <span className="utl__when">{s.when}</span>
                  <span className="utl__title">{s.title}</span>
                  <span className="utl__desc"><span>{s.desc}</span></span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
