import { useEffect, useState, type ReactNode } from "react";
import { Input, Slot, SlotGrid, TicketCard } from "@/design-system/padelion";
import { useMoney } from "@/lib/currency";

const STEPS = [
  { t: "Pick your time", d: "Taken times are greyed out, so you only see what you can book." },
  { t: "We hold it for 15 minutes", d: "Add your name and WhatsApp number while the clock runs." },
  { t: "Pay half, your way", d: "Apple Pay, Google Pay or card. The rest is due 2 hours before you play." },
  { t: "Show your ticket", d: "Your code arrives on WhatsApp. Show it at the desk and walk on court." },
];

function Preview({ i }: { i: number }) {
  const money = useMoney();
  if (i === 0)
    return (
      <div className="stack-4">
        <p className="meta">Court 2, Saturday</p>
        <SlotGrid>
          {["18.00", "18.30", "19.00", "19.30", "20.00", "20.30", "21.00", "21.30"].map((t) => (
            <Slot key={t} time={t} tabIndex={-1} state={t === "20.00" ? "selected" : t === "19.00" || t === "21.30" ? "taken" : "open"} />
          ))}
        </SlotGrid>
      </div>
    );
  if (i === 1)
    return (
      <div className="stack-4">
        <div className="notice pds-num">Held for you, 14.32 left</div>
        <Input label="Your name" value="Raka Pratama" readOnly tabIndex={-1} />
        <Input label="WhatsApp" value="0812 3456 7890" readOnly tabIndex={-1} className="pds-num" />
      </div>
    );
  if (i === 2)
    return (
      <div className="stack-4">
        <div className="sum-line sum-line--total"><span>Deposit, 50%</span><span className="pds-num">{money(477500)}</span></div>
        <div className="walk-pay">
          <span className="walk-pay__opt walk-pay__opt--on">Apple Pay</span>
          <span className="walk-pay__opt">Google Pay</span>
          <span className="walk-pay__opt">Card</span>
        </div>
        <div className="walk-pay__btn pds-num">Pay {money(477500)}</div>
      </div>
    );
  return (
    <TicketCard
      status="Deposit paid"
      title="20.00"
      subtitle="Court 2, Sat"
      details={[
        { label: "Code", value: "PDL-2048" },
        { label: "Court", value: "Court 2" },
        { label: "Length", value: "90 min" },
      ]}
    />
  );
}

const STEP_MS = 8000;

export function Walkthrough({ intro }: { intro?: ReactNode }) {
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [reduce, setReduce] = useState(false);
  useEffect(() => setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  // 01 to 04, then back to 01, 8 seconds each. A click jumps there and the loop carries on from it.
  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(id);
  }, [active, cycle, reduce]);

  return (
    <div className="walk" style={{ ["--walk-ms" as string]: `${STEP_MS}ms` }}>
      <div className="walk__left">
        {intro}
        <ol className="walk__steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <button
                type="button"
                className="walk__step"
                aria-pressed={i === active}
                onClick={() => {
                  setActive(i);
                  setCycle((c) => c + 1);
                }}
              >
                <span className="step__n pds-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="stack-2">
                  <span className="pds-card-title">{s.t}</span>
                  <span className="t2">{s.d}</span>
                </span>
                {i === active && !reduce ? <span key={`${active}-${cycle}`} className="walk__bar" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="walk__preview" aria-live="polite">
        {STEPS.map((s, i) => (
          <div key={s.t} className="walk__pane" data-on={i === active} aria-hidden={i !== active}>
            <div className="walk__card">
              <Preview i={i} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
