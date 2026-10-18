import { supabase } from "@/integrations/supabase/client";
import { addDays, isoAt, jkt, todayJkt } from "@/lib/padel";

export type DeskCourt = { id: string; name: string; kind: string; sort: number };
export type DeskBooking = {
  id: string;
  code: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  status: string;
  total_idr: number;
  paid_idr: number;
  balance_due_at: string | null;
  hold_expires_at: string | null;
};
export type DeskBlock = { court_id: string; starts_at: string; ends_at: string };

export type DeskToday = {
  date: string;
  courts: DeskCourt[];
  bookings: DeskBooking[];
  blocks: DeskBlock[];
  offers: number;
};

export const deskTodayKey = ["desk", "today"] as const;
export const deskChecksKey = ["desk", "checks"] as const;

export async function fetchDeskToday(): Promise<DeskToday> {
  const date = todayJkt();
  const from = isoAt(date, 0);
  const to = isoAt(addDays(date, 1), 0);
  const [courts, bookings, blocks, offers] = await Promise.all([
    supabase.from("courts").select("id,name,kind,sort").eq("is_active", true).order("sort"),
    supabase
      .from("bookings")
      .select("id,code,court_id,starts_at,ends_at,guest_name,status,total_idr,paid_idr,balance_due_at,hold_expires_at")
      .gte("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at"),
    supabase.from("court_blocks").select("court_id,starts_at,ends_at").lt("starts_at", to).gt("ends_at", from),
    supabase.from("waitlist_entries").select("id", { count: "exact", head: true }).eq("status", "offered"),
  ]);
  const err = courts.error || bookings.error || blocks.error || offers.error;
  if (err) throw new Error(err.message);
  return {
    date,
    courts: courts.data ?? [],
    bookings: bookings.data ?? [],
    blocks: blocks.data ?? [],
    offers: offers.count ?? 0,
  };
}

export async function fetchChecksCount(): Promise<number> {
  const { count, error } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .not("flag", "is", null)
    .eq("status", "received");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export function isActive(b: DeskBooking, now: number) {
  if (["deposit_paid", "paid", "played"].includes(b.status)) return true;
  return b.status === "hold" && !!b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now;
}

export function minsOf(iso: string) {
  return jkt(iso).mins;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WD[wd]} ${d} ${MO[m - 1]}`;
}

export function countdown(ms: number) {
  const late = ms < 0;
  const t = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const txt = `${h > 0 ? `${h} h ` : ""}${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
  return late ? `Overdue ${txt}` : `Due in ${txt}`;
}
