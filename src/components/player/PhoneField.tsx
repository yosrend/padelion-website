import { useId, useState, type FocusEventHandler } from "react";
import { ChevronDownIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

// Country codes players at a Jakarta venue actually use. Indonesia first, then the region, then the usual visitors.
export const COUNTRIES: { cc: string; iso: string; name: string; eg: string }[] = [
  { cc: "62", iso: "ID", name: "Indonesia", eg: "812 3456 7890" },
  { cc: "65", iso: "SG", name: "Singapore", eg: "9123 4567" },
  { cc: "60", iso: "MY", name: "Malaysia", eg: "12 345 6789" },
  { cc: "61", iso: "AU", name: "Australia", eg: "412 345 678" },
  { cc: "63", iso: "PH", name: "Philippines", eg: "917 123 4567" },
  { cc: "66", iso: "TH", name: "Thailand", eg: "81 234 5678" },
  { cc: "84", iso: "VN", name: "Vietnam", eg: "91 234 5678" },
  { cc: "81", iso: "JP", name: "Japan", eg: "90 1234 5678" },
  { cc: "82", iso: "KR", name: "South Korea", eg: "10 1234 5678" },
  { cc: "86", iso: "CN", name: "China", eg: "131 2345 6789" },
  { cc: "852", iso: "HK", name: "Hong Kong", eg: "5123 4567" },
  { cc: "886", iso: "TW", name: "Taiwan", eg: "912 345 678" },
  { cc: "91", iso: "IN", name: "India", eg: "81234 56789" },
  { cc: "971", iso: "AE", name: "United Arab Emirates", eg: "50 123 4567" },
  { cc: "44", iso: "GB", name: "United Kingdom", eg: "7400 123456" },
  { cc: "31", iso: "NL", name: "Netherlands", eg: "6 12345678" },
  { cc: "49", iso: "DE", name: "Germany", eg: "1512 3456789" },
  { cc: "33", iso: "FR", name: "France", eg: "6 12 34 56 78" },
  { cc: "34", iso: "ES", name: "Spain", eg: "612 34 56 78" },
  { cc: "1", iso: "US", name: "United States or Canada", eg: "201 555 0123" },
];

/** Split a stored value ("+65 9123 4567", "0812...", "") into country code and the local part. */
export function splitWa(value: string): { cc: string; local: string } {
  const v = value.trim();
  if (!v.startsWith("+")) return { cc: "62", local: v.replace(/^0/, "") };
  const digits = v.slice(1);
  const hit = [...COUNTRIES].sort((a, b) => b.cc.length - a.cc.length).find((c) => digits.replace(/\D/g, "").startsWith(c.cc));
  if (!hit) return { cc: "62", local: v };
  const rest = digits.replace(/^\s*/, "").slice(hit.cc.length).trim();
  return { cc: hit.cc, local: rest };
}

/** WhatsApp number with a country code picker. The value is always "+CC local", or "" while empty. */
export function PhoneField({
  id, label = "WhatsApp number", hint, value, onChange, onBlur, error,
}: {
  id?: string; label?: string; hint?: string; value: string; onChange: (v: string) => void; onBlur?: FocusEventHandler<HTMLInputElement>; error?: string | null;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  // The picked country lives here too, so choosing it before typing (or clearing the number) does not snap back to +62.
  const [picked, setPicked] = useState(() => (value.trim() ? splitWa(value).cc : "62"));
  const parsed = splitWa(value);
  const cc = value.trim() ? parsed.cc : picked;
  const local = value.trim() ? parsed.local : "";
  const country = COUNTRIES.find((c) => c.cc === cc) ?? COUNTRIES[0];
  const set = (nextCc: string, nextLocal: string) => {
    setPicked(nextCc);
    onChange(nextLocal.trim() ? `+${nextCc} ${nextLocal.replace(/^0+/, "")}` : "");
  };
  // A pasted or typed full number ("+65 9123 4567") picks its own country.
  const typed = (text: string) => {
    // digits and spaces only, and no more than 13 digits after the country code
    const clean = text.replace(/[^\d+ ]/g, "");
    if (!clean.trim().startsWith("+") && clean.replace(/\D/g, "").length > 13) return;
    text = clean;
    if (text.trim().startsWith("+")) {
      const p = splitWa(text);
      if (p.local.replace(/\D/g, "").length > 13) return;
      return set(p.cc, p.local.replace(/^\+/, ""));
    }
    set(cc, text);
  };
  const descId = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="pds-field">
      <label className="pds-field__label" htmlFor={inputId}>{label}</label>
      <div className={`phone-field${error ? " phone-field--error" : ""}`}>
        <span className="phone-field__cc">
          <select
            aria-label="Country code"
            value={cc}
            onChange={(e) => set(e.target.value, local)}
          >
            {COUNTRIES.map((c) => <option key={c.cc + c.iso} value={c.cc}>{c.name} +{c.cc}</option>)}
          </select>
          <span className="phone-field__cc-face" aria-hidden="true">
            <span className="phone-field__iso">{country.iso}</span>
            <span className="pds-num">+{country.cc}</span>
            <ChevronDownIcon />
          </span>
        </span>
        <input
          id={inputId}
          className="phone-field__input pds-num"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={17}
          placeholder={country.eg}
          value={local}
          onChange={(e) => typed(e.target.value)}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={descId}
        />
      </div>
      {error ? (
        <span id={descId} className="pds-field__error" role="alert"><ExclamationCircleIcon aria-hidden="true" />{error}</span>
      ) : hint ? (
        <span id={descId} className="pds-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
