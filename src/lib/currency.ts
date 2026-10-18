import { useSyncExternalStore } from "react";
import { idr } from "@/lib/padel";

// Prices live in rupiah. Visitors can choose to read them in US dollars.
// Payment always happens in rupiah, so dollar amounts are shown as an estimate.

export type Currency = "IDR" | "USD";

/** Fixed demo rate: 1 USD = Rp 16.300. */
export const IDR_PER_USD = 16300;

const KEY = "padelion.currency";
const listeners = new Set<() => void>();
let current: Currency | null = null;

function read(): Currency {
  if (current) return current;
  try {
    current = localStorage.getItem(KEY) === "USD" ? "USD" : "IDR";
  } catch {
    current = "IDR";
  }
  return current;
}

export function setCurrency(c: Currency) {
  current = c;
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* private mode: keep it for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, read, () => "IDR");
}

export function usd(n: number) {
  const v = n / IDR_PER_USD;
  // Whole dollars for court prices, cents only for small add-ons.
  return "US$" + (v >= 10 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2).replace(/\.00$/, ""));
}

export function formatMoney(n: number, c: Currency) {
  return c === "USD" ? usd(n) : idr(n);
}

/** Formatter for the chosen currency. Use it for every price a player reads. */
export function useMoney() {
  const c = useCurrency();
  return (n: number) => formatMoney(n, c);
}
