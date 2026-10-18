export const TZ = "Asia/Jakarta";
export const OPEN_MIN = 6 * 60;
export const CLOSE_MIN = 23 * 60;

export type Court = { id: string; name: string; kind: string; sort: number };
export type PriceRule = {
  court_id: string;
  off_peak_idr: number;
  peak_idr: number;
  weekday_peak_start?: number;
  weekday_peak_end?: number;
  weekend_all_peak?: boolean;
};
export type Addon = { id: string; name: string; price_idr: number; sort: number };
export type Busy = { court_id: string; starts_at: string; ends_at: string; kind?: string };

export type BookingView = {
  code: string;
  court: string;
  court_id: string;
  minutes: number;
  court_kind: string;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  status: "hold" | "deposit_paid" | "paid" | "expired" | "cancelled" | "no_show" | "played";
  subtotal_idr: number;
  addons_idr: number;
  total_idr: number;
  paid_idr: number;
  balance_due_at: string | null;
  hold_expires_at: string | null;
  addons: { name: string; qty: number; unit_price_idr: number }[];
  note?: string | null;
  checked_in_at?: string | null;
};

export function idr(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID").replace(/,/g, ".");
}

export function hm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}.${String(m).padStart(2, "0")}`;
}

/** Local Jakarta parts of an ISO timestamp. */
export function jkt(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const mins = Number(get("hour")) * 60 + Number(get("minute"));
  return { date, mins, weekday: get("weekday") };
}

export function timeLabel(iso: string) {
  return hm(jkt(iso).mins);
}

export function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function isoAt(dateStr: string, mins: number) {
  return `${dateStr}T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00+07:00`;
}

export function todayJkt() {
  return jkt(new Date()).date;
}

export function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return jkt(d).date;
}

export function isPeak(dateStr: string, mins: number, rule?: PriceRule) {
  const dow = new Date(`${dateStr}T12:00:00+07:00`).getUTCDay();
  if ((dow === 0 || dow === 6) && (rule?.weekend_all_peak ?? true)) return true;
  return mins >= (rule?.weekday_peak_start ?? 17) * 60 && mins < (rule?.weekday_peak_end ?? 23) * 60;
}

export function priceFor(rule: PriceRule | undefined, dateStr: string, startMins: number, minutes: number) {
  if (!rule) return 0;
  const rate = isPeak(dateStr, startMins, rule) ? rule.peak_idr : rule.off_peak_idr;
  return (rate * minutes) / 60;
}

/** True when [start, start+len) on this court overlaps any busy range on dateStr. */
export function overlaps(busy: Busy[], courtId: string, dateStr: string, start: number, len: number) {
  const s = new Date(isoAt(dateStr, start)).getTime();
  const e = s + len * 60000;
  return busy.some(
    (b) => b.court_id === courtId && new Date(b.starts_at).getTime() < e && new Date(b.ends_at).getTime() > s,
  );
}

export function statusCopy(s: BookingView["status"]) {
  switch (s) {
    case "paid":
      return "Paid in full";
    case "deposit_paid":
      return "Deposit paid";
    case "hold":
      return "On hold";
    case "expired":
      return "Hold ended";
    case "cancelled":
      return "Cancelled";
    case "played":
      return "Played";
    case "no_show":
      return "No-show";
  }
}

const WA_KEY = "padelion.wa.";
export function rememberWa(code: string, wa: string) {
  try {
    sessionStorage.setItem(WA_KEY + code.toUpperCase(), wa);
  } catch {
    /* ignore */
  }
}
export function recallWa(code: string) {
  try {
    return sessionStorage.getItem(WA_KEY + code.toUpperCase());
  } catch {
    return null;
  }
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s}`;
}

export function maskWa(wa: string) {
  const d = wa.replace(/\D/g, "");
  return `${d.slice(0, 4)} **** ${d.slice(-4)}`;
}
