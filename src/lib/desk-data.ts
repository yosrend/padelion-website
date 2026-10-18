import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, isoAt, todayJkt } from "@/lib/padel";

export type Row = Record<string, any>;

export async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown;
}

export async function logLine(kind: string, message: string, booking_id: string | null = null) {
  await supabase.from("system_log").insert({ kind, message, booking_id });
}

/** Ticks every second for countdowns. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Refetches every desk query when any of these tables change. */
export function useLive(name: string, tables: string[]) {
  const qc = useQueryClient();
  useEffect(() => {
    let ch = supabase.channel(`desk-${name}`);
    for (const t of tables) {
      ch = ch.on("postgres_changes" as never, { event: "*", schema: "public", table: t } as never, () => {
        qc.invalidateQueries({ queryKey: ["desk"] });
      });
    }
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, name, tables.join(",")]);
}

export async function fetchCourtsAll() {
  const { data, error } = await supabase.from("courts").select("id,name,kind,sort,is_active").order("sort");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchBookingsList() {
  const from = isoAt(addDays(todayJkt(), -7), 0);
  const { data, error } = await supabase
    .from("bookings")
    .select("id,code,court_id,starts_at,ends_at,guest_name,guest_whatsapp,status,subtotal_idr,addons_idr,total_idr,paid_idr,balance_due_at,hold_expires_at")
    .gte("starts_at", from)
    .order("starts_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchBookingDetail(id: string) {
  const [ad, pay, log] = await Promise.all([
    supabase.from("booking_addons").select("qty,unit_price_idr,addons(name)").eq("booking_id", id),
    supabase.from("payments").select("id,amount_idr,method,status,created_at,flag").eq("booking_id", id).order("created_at"),
    supabase.from("system_log").select("id,message,created_at").eq("booking_id", id).order("created_at"),
  ]);
  const err = ad.error || pay.error || log.error;
  if (err) throw new Error(err.message);
  return { addons: ad.data ?? [], payments: pay.data ?? [], log: log.data ?? [] };
}

export async function fetchPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select("id,booking_id,amount_idr,method,status,flag,payer,note,created_at,resolution,bookings(code,guest_name,court_id,starts_at,ends_at)")
    .gte("created_at", isoAt(todayJkt(), 0))
    .order("created_at", { ascending: false });
  const flagged = await supabase
    .from("payments")
    .select("id,booking_id,amount_idr,method,status,flag,payer,note,created_at,resolution,bookings(code,guest_name,court_id,starts_at,ends_at)")
    .not("flag", "is", null)
    .eq("status", "received");
  if (error || flagged.error) throw new Error((error || flagged.error)!.message);
  return { today: data ?? [], flagged: flagged.data ?? [] };
}

export async function fetchBlocks() {
  const from = isoAt(todayJkt(), 0);
  const { data, error } = await supabase.from("court_blocks").select("id,court_id,starts_at,ends_at,reason").gt("ends_at", from).order("starts_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchWaitlist() {
  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("id,court_id,starts_at,guest,position,status,offer_expires_at")
    .in("status", ["waiting", "offered"])
    .gte("starts_at", isoAt(todayJkt(), 0))
    .order("starts_at")
    .order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function mmss(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
}

export function activeBooking(b: Row, now: number) {
  if (["deposit_paid", "paid", "played"].includes(b.status)) return true;
  return b.status === "hold" && !!b.hold_expires_at && new Date(b.hold_expires_at).getTime() > now;
}

export function bookingChip(b: Row, now: number): { tone: "paid" | "balance" | "hold" | "urgent"; label: string } {
  if (b.status === "hold") return activeBooking(b, now) ? { tone: "hold", label: "On hold" } : { tone: "urgent", label: "Expired" };
  if (b.status === "cancelled") return { tone: "urgent", label: "Cancelled" };
  if (b.status === "expired") return { tone: "urgent", label: "Expired" };
  if (b.total_idr > b.paid_idr) return { tone: "balance", label: "Balance due" };
  return { tone: "paid", label: "Paid" };
}
