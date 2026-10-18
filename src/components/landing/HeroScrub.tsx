import { useEffect, useRef, useState, type ReactNode } from "react";

// The landing hero as one continuous film: from the air over Kemang, through the glass dome,
// past the desk, around the three courts and into a serve. On desktop the visitor's scroll plays it
// forward and back as a sharp 1920px image sequence drawn on a canvas. Phones get the same film as a
// quiet loop; reduced motion gets the first frame.

const FRAMES = 239;
const frameUrl = (i: number) => `/hero/frames/${String(i).padStart(3, "0")}.webp`;
const LOOP_SRC = "/hero/hero-loop.mp4";
const POSTER = "/hero/hero-poster.jpg";

const CHAPTERS: { from: number; to: number; text: string }[] = [
  { from: 0.11, to: 0.23, text: "Three courts under one glass dome, just off Jl. Kemang Raya." },
  { from: 0.24, to: 0.39, text: "Walk past the desk. Your name is already on the board." },
  { from: 0.4, to: 0.61, text: "Two blue courts and a neon green center court. Pick yours." },
  { from: 0.62, to: 0.85, text: "First serve at 20.00. Booked in about a minute." },
];

type Mode = "poster" | "loop" | "scrub";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export function HeroScrub({ children }: { children: ReactNode }) {
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  const dirty = useRef(true);
  const [mode, setMode] = useState<Mode>("poster");
  const [ready, setReady] = useState(false);
  const [p, setP] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setMode("poster");
    const desk = window.matchMedia("(min-width: 901px) and (pointer: fine)").matches;
    setMode(desk ? "scrub" : "loop");
  }, []);

  // Desktop: load the frames coarse to fine (every 16th, then every 8th, and so on).
  // Only the first coarse pass (about 16 frames) loads with the page. The rest waits until the
  // visitor starts scrolling, so someone who reads the hero and leaves never pulls the full film.
  useEffect(() => {
    if (mode !== "scrub") return;
    let alive = true;
    const order: number[] = [];
    const seen = new Set<number>();
    for (const step of [16, 8, 4, 2, 1])
      for (let i = 0; i < FRAMES; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (!seen.has(FRAMES - 1)) order.splice(1, 0, FRAMES - 1);
    const firstPass = Math.ceil(FRAMES / 16) + 1;
    let go = window.scrollY > 0;
    imgs.current = new Array(FRAMES).fill(null);
    let next = 0;
    let waiting = 0;
    const pump = () => {
      if (!alive || next >= order.length) return;
      if (!go && next >= firstPass) { waiting++; return; }
      const i = order[next++];
      const im = new Image();
      im.decoding = "async";
      im.onload = () => {
        if (!alive) return;
        imgs.current[i] = im;
        dirty.current = true;
        if (i === 0) setReady(true);
        pump();
      };
      im.onerror = pump;
      im.src = frameUrl(i);
    };
    const start = () => {
      if (go) return;
      go = true;
      const n = Math.max(waiting, 1);
      waiting = 0;
      for (let k = 0; k < n; k++) pump();
    };
    const events = ["scroll", "wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, start, { passive: true, once: true }));
    for (let k = 0; k < 6; k++) pump();
    return () => {
      alive = false;
      events.forEach((e) => window.removeEventListener(e, start));
    };
  }, [mode]);

  // Scroll position drives the film. A short ease keeps the frames from jumping on a fast wheel.
  useEffect(() => {
    if (mode !== "scrub") return;
    let raf = 0;
    let shown = 0;
    let lastP = -1;
    let lastFrame = -1;
    const draw = (want: number) => {
      const c = canvas.current;
      if (!c) return;
      // nearest frame that has arrived
      let im: HTMLImageElement | null = null;
      let got = -1;
      for (let d = 0; d < FRAMES && !im; d++) {
        for (const j of [want - d, want + d]) {
          if (j >= 0 && j < FRAMES && imgs.current[j]) { im = imgs.current[j]; got = j; break; }
        }
      }
      if (!im) return;
      if (got === lastFrame && !dirty.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(c.clientWidth * dpr);
      const h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const s2 = Math.max(w / im.naturalWidth, h / im.naturalHeight);
      const dw = im.naturalWidth * s2;
      const dh = im.naturalHeight * s2;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
      lastFrame = got;
      dirty.current = got !== want;
    };
    const onResize = () => { dirty.current = true; };
    window.addEventListener("resize", onResize);
    const tick = () => {
      const el = wrap.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const run = Math.max(1, r.height - window.innerHeight);
        const target = clamp(-r.top / run);
        shown += (target - shown) * 0.18;
        if (Math.abs(target - shown) < 0.0005) shown = target;
        if (Math.abs(shown - lastP) > 0.0004) { lastP = shown; setP(shown); }
        draw(Math.round(shown * (FRAMES - 1)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [mode]);

  // The booking content shows at the start, steps aside while the film plays, and returns at the end.
  const content = mode === "scrub" ? Math.max(1 - ramp(p, 0.06, 0.14), ramp(p, 0.86, 0.95)) : 1;

  return (
    <section ref={wrap} className={`hero-scrub hero-scrub--${mode}`}>
      <div className="hero hero-scrub__sticky wrap">
        <img className="hero__img hero-scrub__poster" src={POSTER} alt="" aria-hidden="true" width={1600} height={900} fetchPriority="high" data-hide={ready && mode !== "poster"} />
        {mode === "loop" ? (
          <video className="hero__img" src={LOOP_SRC} poster={POSTER} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" onCanPlay={() => setReady(true)} />
        ) : null}
        {mode === "scrub" ? (
          <canvas ref={canvas} className="hero__img hero-scrub__canvas" aria-hidden="true" />
        ) : null}
        <div className="hero__shade" aria-hidden="true" />

        {mode === "scrub"
          ? CHAPTERS.map((c) => {
              const o = Math.min(ramp(p, c.from, c.from + 0.04), 1 - ramp(p, c.to - 0.04, c.to));
              return (
                <p key={c.text} className="hero-scrub__chapter" style={{ opacity: o, transform: `translateY(${(1 - o) * 16}px)` }} aria-hidden={o < 0.5}>
                  {c.text}
                </p>
              );
            })
          : null}

        <div className="hero-scrub__content" style={{ opacity: content, pointerEvents: content < 0.5 ? "none" : undefined }}>
          {children}
        </div>

        {mode === "scrub" ? (
          <>
            <p className="hero-scrub__hint" style={{ opacity: 1 - ramp(p, 0, 0.04) }} aria-hidden="true">Scroll to step inside</p>
            <div className="hero-scrub__bar" aria-hidden="true"><span style={{ transform: `scaleX(${p})` }} /></div>
          </>
        ) : null}
      </div>
    </section>
  );
}
