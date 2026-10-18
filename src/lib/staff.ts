import { supabase } from "@/integrations/supabase/client";

export type StaffMe = { name: string; role: "front_desk" | "owner" };

export async function getStaffMe(): Promise<StaffMe | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.rpc("my_staff" as never);
  const row = (data as StaffMe[] | null)?.[0];
  return row ?? null;
}

export function homeFor(role: StaffMe["role"]) {
  return role === "owner" ? "/owner" : "/desk";
}
