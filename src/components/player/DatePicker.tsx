import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month calendar for any day from today up to the booking limit. Opens as a sheet on phones, a popover on desktop. */
export function DatePicker({
  value, min, max, onPick, onClose,
}: { value: string | null; min: string; max: string; onPick: (d: string) => void; onClose: () => void }) {
  const start = value ?? min;
  const [y0, m0] = start.split("-").map(Number);
  const [view, setView] = useState({ y: y0, m: m0 - 1 });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("[aria-pressed='true'], button.dp__day:not(:disabled)")?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(view.y, view.m, i + 1))];
  const monthName = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const canPrev = ymd(view.y, view.m, 1) > `${min.slice(0, 7)}-01`;
  const canNext = ymd(view.y + Math.floor((view.m + 1) / 12), (view.m + 1) % 12, 1) <= max;
  const move = (d: number) => setView((v) => {
    const m = v.m + d;
    return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
  });

  return (
    <div className="dp" role="dialog" aria-modal="true" aria-label="Pick a date">
      <button type="button" className="dp__scrim" aria-label="Close" onClick={onClose} />
      <div className="dp__panel" ref={panel}>
        <div className="dp__head">
          <button type="button" className="dp__nav" aria-label="Previous month" disabled={!canPrev} onClick={() => move(-1)}><ChevronLeftIcon /></button>
          <p className="dp__month" aria-live="polite">{monthName}</p>
          <button type="button" className="dp__nav" aria-label="Next month" disabled={!canNext} onClick={() => move(1)}><ChevronRightIcon /></button>
          <button type="button" className="dp__nav dp__close" aria-label="Close" onClick={onClose}><XMarkIcon /></button>
        </div>
        <div className="dp__grid" role="grid">
          {WEEK.map((w) => <span key={w} className="dp__wk" aria-hidden="true">{w.slice(0, 2)}</span>)}
          {cells.map((d, i) =>
            d ? (
              <button
                key={d}
                type="button"
                className={`dp__day pds-num${d === min ? " dp__day--today" : ""}`}
                aria-pressed={d === value}
                aria-label={new Date(`${d}T12:00:00+07:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                disabled={d < min || d > max}
                onClick={() => { onPick(d); onClose(); }}
              >
                {Number(d.slice(8))}
              </button>
            ) : <span key={`x${i}`} />,
          )}
        </div>
        <p className="dp__foot">Book any day up to two months ahead.</p>
      </div>
    </div>
  );
}
