import { useEffect, useMemo, useRef, useState } from "react";
import { hm } from "@/lib/padel";

type Cell = { d: number; h: number; n: number };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LIME = "#84cc16";
const DEEP = "#166534";

/** Width of an element, kept in sync, so SVG text stays crisp instead of being stretched by a viewBox. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** True once the element has been on screen, so the draw-in plays the first time only. */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setSeen(true);
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
};

/** Bookings per day of the week: one hue, bars grow from the baseline one after another. */
export function DayBars({ grid }: { grid: Cell[] }) {
  const [box, w] = useWidth<HTMLDivElement>();
  const [card, seen] = useSeen<HTMLDivElement>();
  const [tip, setTip] = useState<number | null>(null);
  const totals = useMemo(() => DAYS.map((_, i) => grid.filter((g) => g.d === i + 1).reduce((s, g) => s + g.n, 0)), [grid]);
  const max = niceMax(Math.max(...totals, 1));
  const top = Math.max(...totals);
  const H = 240;
  const padL = 32;
  const padB = 28;
  const padT = 22;
  const iw = Math.max(0, w - padL);
  const ih = H - padB - padT;
  const slot = iw / 7;
  const bw = Math.min(56, slot * 0.56);
  const ticks = [0, max / 2, max];

  return (
    <div className="och" ref={card}>
      <div className="och__head">
        <p className="och__title">Booked hours by day</p>
        <p className="och__hint pds-num">{totals.reduce((a, b) => a + b, 0)} court hours this week</p>
      </div>
      <div ref={box} className="och__plot" onPointerLeave={() => setTip(null)}>
        {w > 0 ? (
          <svg width={w} height={H} role="img" aria-label={`Booked hours by day: ${DAYS.map((d, i) => `${d} ${totals[i]}`).join(", ")}`}>
            <defs>
              <linearGradient id="bar-wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6ff8f" /><stop offset="1" stopColor="#c2ec4f" /></linearGradient>
              <linearGradient id="bar-we" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4ff3a" /><stop offset="1" stopColor="#5fb21a" /></linearGradient>
            </defs>
            {ticks.map((t) => {
              const y = padT + ih - (t / max) * ih;
              return (
                <g key={t}>
                  <line x1={padL} x2={w} y1={y} y2={y} className="och__grid" />
                  <text x={padL - 8} y={y + 4} textAnchor="end" className="och__axis pds-num">{t}</text>
                </g>
              );
            })}
            {totals.map((v, i) => {
              const h = (v / max) * ih;
              const x = padL + slot * i + (slot - bw) / 2;
              const y = padT + ih - h;
              const we = i >= 5;
              return (
                <g key={i} onPointerEnter={() => setTip(i)} onFocus={() => setTip(i)} onBlur={() => setTip(null)} tabIndex={0} aria-label={`${DAYS[i]}, ${v} booked hours`}>
                  <rect x={padL + slot * i} y={padT} width={slot} height={ih} fill="transparent" />
                  <path
                    className={`och__bar${seen ? " is-on" : ""}${tip === i ? " is-hot" : ""}`}
                    style={{ transitionDelay: `${i * 70}ms`, fill: we ? "url(#bar-we)" : "url(#bar-wd)" }}
                    d={`M${x},${padT + ih} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${padT + ih} Z`}
                  />
                  {v === top ? <text x={x + bw / 2} y={y - 8} textAnchor="middle" className={`och__val pds-num${seen ? " is-on" : ""}`}>{v}</text> : null}
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="och__axis">{DAYS[i]}</text>
                </g>
              );
            })}
          </svg>
        ) : <div style={{ height: H }} />}
        {tip !== null && w > 0 ? (
          <div className="och__tip" style={{ left: padL + slot * tip + slot / 2, top: padT + ih - (totals[tip] / max) * ih }}>
            <strong className="pds-num">{totals[tip]} booked hours</strong>
            <span>{DAYS[tip]}{tip >= 5 ? ", weekend" : ""}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Average bookings through the day, weekdays against weekends. Lines draw in, a crosshair reads both. */
export function HourLines({ grid }: { grid: Cell[] }) {
  const [box, w] = useWidth<HTMLDivElement>();
  const [card, seen] = useSeen<HTMLDivElement>();
  const [hx, setHx] = useState<number | null>(null);
  const hours = useMemo(() => Array.from({ length: 17 }, (_, i) => 6 + i), []);
  const avg = (days: number[]) => hours.map((h) => days.reduce((s, d) => s + (grid.find((g) => g.d === d && g.h === h)?.n ?? 0), 0) / days.length);
  const wd = useMemo(() => avg([1, 2, 3, 4, 5]), [grid]);
  const we = useMemo(() => avg([6, 7]), [grid]);
  const max = Math.max(1, ...wd, ...we) * 1.15;
  const H = 240;
  const padL = 32;
  const padR = 78;
  const padB = 28;
  const padT = 14;
  const iw = Math.max(0, w - padL - padR);
  const ih = H - padB - padT;
  const X = (i: number) => padL + (i / (hours.length - 1)) * iw;
  const Y = (v: number) => padT + ih - (v / max) * ih;
  const path = (vs: number[]) => vs.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const area = (vs: number[]) => `${path(vs)} L${X(vs.length - 1)},${padT + ih} L${X(0)},${padT + ih} Z`;
  const series = [
    { name: "Weekends", vs: we, color: DEEP, cls: "och__line--green", id: "ar-we" },
    { name: "Weekdays", vs: wd, color: LIME, cls: "och__line--blue", id: "ar-wd" },
  ];

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - padL) / iw) * (hours.length - 1));
    setHx(i >= 0 && i < hours.length ? i : null);
  }

  return (
    <div className="och" ref={card}>
      <div className="och__head">
        <p className="och__title">Courts in use through the day</p>
        <div className="och__legend" aria-hidden="true">
          {series.slice().reverse().map((s) => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}
        </div>
      </div>
      <div ref={box} className="och__plot">
        {w > 0 ? (
          <svg width={w} height={H} onPointerMove={move} onPointerLeave={() => setHx(null)} role="img" aria-label="Average courts in use per hour, weekdays and weekends">
            <defs>
              <linearGradient id="ar-wd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4ff3a" stopOpacity="0.7" /><stop offset="1" stopColor="#d4ff3a" stopOpacity="0" /></linearGradient>
              <linearGradient id="ar-we" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4fae1c" stopOpacity="0.28" /><stop offset="1" stopColor="#4fae1c" stopOpacity="0" /></linearGradient>
            </defs>
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={padL} x2={padL + iw} y1={padT + ih - t * ih} y2={padT + ih - t * ih} className="och__grid" />
                <text x={padL - 8} y={padT + ih - t * ih + 4} textAnchor="end" className="och__axis pds-num">{(t * max).toFixed(t ? 1 : 0)}</text>
              </g>
            ))}
            {hours.filter((h) => h % 3 === 0).map((h) => (
              <text key={h} x={X(h - 6)} y={H - 8} textAnchor="middle" className="och__axis pds-num">{hm(h * 60)}</text>
            ))}
            {series.map((s, si) => {
              const ya = Y(series[0].vs[series[0].vs.length - 1]);
              const yb = Y(series[1].vs[series[1].vs.length - 1]);
              const gap = 14 - Math.abs(ya - yb);
              const off = gap > 0 ? (si === 0 ? (ya <= yb ? -gap / 2 : gap / 2) : (yb < ya ? -gap / 2 : gap / 2)) : 0;
              return (
              <g key={s.name}>
                <path d={area(s.vs)} className={`och__area${seen ? " is-on" : ""}`} style={{ fill: `url(#${s.id})` }} />
                <path d={path(s.vs)} pathLength={1} className={`och__line ${s.cls}${seen ? " is-on" : ""}`} style={{ stroke: s.color }} />
                <text x={X(hours.length - 1) + 10} y={Y(s.vs[s.vs.length - 1]) + 4 + off} className={`och__end${seen ? " is-on" : ""}`}>{s.name}</text>
              </g>
              );
            })}
            {hx !== null ? (
              <g>
                <line x1={X(hx)} x2={X(hx)} y1={padT} y2={padT + ih} className="och__cross" />
                {series.map((s) => <circle key={s.name} cx={X(hx)} cy={Y(s.vs[hx])} r={5} style={{ fill: s.color }} className="och__dot" />)}
              </g>
            ) : null}
          </svg>
        ) : <div style={{ height: H }} />}
        {hx !== null && w > 0 ? (
          <div className="och__tip och__tip--side" style={{ left: X(hx), top: padT }}>
            <span className="och__tip-h pds-num">{hm(hours[hx] * 60)}</span>
            {series.slice().reverse().map((s) => (
              <span key={s.name} className="och__tip-row"><i style={{ background: s.color }} /><strong className="pds-num">{s.vs[hx].toFixed(1)}</strong> courts, {s.name.toLowerCase()}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Counts a number up the first time it shows. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [n, setN] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(value);
    let raf = 0;
    const t0 = performance.now();
    const D = 1100;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref}>{format(n)}</span>;
}
