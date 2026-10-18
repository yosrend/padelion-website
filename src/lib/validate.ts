import { useState } from "react";

// Shared form rules. Each check returns an error message, or null when the value is fine.
// Messages say what to do, in the player's words, with an example where it helps.

export type Check = (value: string) => string | null;

/**
 * WhatsApp number to one canonical form. Indonesian numbers become 08xxxxxxxxxx.
 * Numbers with another country code (written "+65 9123 4567") become +6591234567.
 * Returns null when it cannot be a mobile number.
 */
export function normalizeWa(value: string): string | null {
  const raw = value.trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && !d.startsWith("62")) {
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }
  if (d.startsWith("62")) d = d.slice(2);
  d = "0" + d.replace(/^0+/, "");
  return /^08\d{8,11}$/.test(d) ? d : null;
}

export const rules = {
  name: ((v) => {
    const t = v.trim();
    if (!t) return "Add your name so the desk knows who is playing.";
    if (t.length < 2) return "Your name needs at least 2 letters.";
    if (!/\p{L}/u.test(t)) return "Use letters for your name.";
    return null;
  }) as Check,

  staffName: ((v) => {
    const t = v.trim();
    if (!t) return "Add a name.";
    if (t.length < 2) return "The name needs at least 2 letters.";
    return null;
  }) as Check,

  wa: ((v) => {
    if (!v.trim()) return "Add your WhatsApp number. Your ticket goes there.";
    if (!normalizeWa(v)) return v.trim().startsWith("+") && !v.trim().startsWith("+62") ? "This number looks too short or too long. Check the digits after the country code." : "Use a mobile number, like 812 3456 7890.";
    return null;
  }) as Check,

  email: ((v) => {
    const t = v.trim();
    if (!t) return "Add an email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return "This email looks incomplete, like name@mail.com.";
    return null;
  }) as Check,

  emailOptional: ((v) => (v.trim() ? rules.email(v) : null)) as Check,

  password: ((v) => (v ? null : "Add your password.")) as Check,

  otp: ((v) => {
    if (!v) return "Add the 4 digit code.";
    if (!/^\d{4}$/.test(v)) return "The code has 4 digits.";
    return null;
  }) as Check,
};

/**
 * Tracks which fields were touched so errors show after the first blur or the first submit,
 * not while the person is still typing their first character.
 */
export function useFieldErrors<K extends string>(checks: Record<K, () => string | null>) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const keys = Object.keys(checks) as K[];

  const errorOf = (k: K) => checks[k]();
  const shown = (k: K) => ((submitted || touched[k]) ? errorOf(k) : null);
  const valid = keys.every((k) => !errorOf(k));

  return {
    /** Error to show for a field, or null. */
    error: shown,
    /** Spread on the input: marks the field touched when it loses focus. */
    blur: (k: K) => ({ onBlur: () => setTouched((t) => ({ ...t, [k]: true })) }),
    valid,
    /** Call on submit. Shows every error and focuses the first invalid field by its id. Returns true when valid. */
    check(ids?: Partial<Record<K, string>>) {
      setSubmitted(true);
      const first = keys.find((k) => errorOf(k));
      if (first && ids?.[first] && typeof document !== "undefined") document.getElementById(ids[first]!)?.focus();
      return !first;
    },
    reset() {
      setTouched({});
      setSubmitted(false);
    },
  };
}
