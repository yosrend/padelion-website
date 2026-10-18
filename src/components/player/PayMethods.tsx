import type { ReactNode } from "react";
import { CreditCardIcon, LockClosedIcon } from "@heroicons/react/24/outline";

// Global checkout for the demo: the wallets and cards a visitor from anywhere already uses.
// Nothing is charged. The sandbox card is fixed, so no real card details are ever typed here.

export type PayMethod = "apple" | "google" | "card";

export const PAY_LABEL: Record<PayMethod, string> = {
  apple: "Apple Pay",
  google: "Google Pay",
  card: "Card",
};

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="paym__logo">
      <path fill="currentColor" d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.2 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="paym__logo">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.8h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.8 8.1 22 12 22z" />
      <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 2.9 14.7 2 12 2 8.1 2 4.7 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </svg>
  );
}

export function PayMethods({ value, onChange }: { value: PayMethod; onChange: (m: PayMethod) => void }) {
  const opts: { k: PayMethod; icon: ReactNode; note: string }[] = [
    { k: "apple", icon: <AppleMark />, note: "Face ID or Touch ID" },
    { k: "google", icon: <GoogleMark />, note: "Any saved card" },
    { k: "card", icon: <CreditCardIcon className="paym__logo" aria-hidden="true" />, note: "Visa, Mastercard, Amex" },
  ];
  return (
    <div className="paym">
      <div className="paym__opts" role="radiogroup" aria-label="Pay with">
        {opts.map((o) => (
          <button key={o.k} type="button" role="radio" aria-checked={value === o.k} className="paym__opt" onClick={() => onChange(o.k)}>
            {o.icon}
            <span className="paym__name">{PAY_LABEL[o.k]}</span>
            <span className="paym__note">{o.note}</span>
          </button>
        ))}
      </div>
      {value === "card" ? (
        <div className="paym__card pds-num" aria-label="Sandbox test card">
          <span className="paym__chip" aria-hidden="true" />
          <span className="paym__num">4242 4242 4242 4242</span>
          <span className="paym__meta">Sandbox card, 12 / 30</span>
        </div>
      ) : null}
      <p className="paym__safe">
        <LockClosedIcon aria-hidden="true" />
        Demo checkout. No real money moves and no card details are collected.
      </p>
    </div>
  );
}
