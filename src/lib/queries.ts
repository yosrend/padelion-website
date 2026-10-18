import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Addon, Busy, Court, PriceRule } from "./padel";
import { demoBusy } from "./demo-busy";

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  staleTime: 20_000,
  queryFn: async () => {
    const [c, p, a] = await Promise.all([
      supabase.from("courts").select("id,name,kind,sort").eq("is_active", true).order("sort"),
      supabase.from("price_rules").select("court_id,off_peak_idr,peak_idr,weekday_peak_start,weekday_peak_end,weekend_all_peak"),
      supabase.from("addons").select("id,name,price_idr,sort").eq("is_active", true).order("sort"),
    ]);
    if (c.error) throw c.error;
    if (p.error) throw p.error;
    if (a.error) throw a.error;
    return { courts: c.data as Court[], prices: p.data as PriceRule[], addons: a.data as Addon[] };
  },
});

export const availabilityQuery = (date: string) =>
  queryOptions({
    queryKey: ["availability", date],
    staleTime: 15_000,
    queryFn: async () => {
      const [{ data, error }, courts] = await Promise.all([
        supabase.rpc("get_availability", { _date: date }),
        supabase.from("courts").select("id,sort").eq("is_active", true),
      ]);
      if (error) throw error;
      const real = (data ?? []) as Busy[];
      return [...real, ...demoBusy(date, courts.data ?? [], real)];
    },
  });

export type VenueSettings = { hold_minutes: number; deposit_pct: number; balance_hours: number; reschedule_hours: number; offer_minutes: number };
export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  staleTime: 20_000,
  queryFn: async () => {
    const { data, error } = await supabase.from("venue_settings").select("hold_minutes,deposit_pct,balance_hours,reschedule_hours,offer_minutes").eq("id", 1).maybeSingle();
    if (error) throw error;
    return (data ?? { hold_minutes: 15, deposit_pct: 50, balance_hours: 2, reschedule_hours: 12, offer_minutes: 15 }) as VenueSettings;
  },
});
