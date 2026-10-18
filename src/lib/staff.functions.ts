import { createServerFn } from "@tanstack/react-start";

export const DEMO_STAFF = [
  { email: "desk@padelion.demo", name: "Dewi", role: "front_desk" as const },
  { email: "owner@padelion.demo", name: "Hendra Wijaya", role: "owner" as const },
];
export const DEMO_PASSWORD = "Padelion2026";

// Idempotent: makes sure the two public demo accounts exist. Creates nothing else.
export const ensureDemoStaff = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.from("staff").select("user_id");
  if ((existing?.length ?? 0) >= DEMO_STAFF.length) return { ok: true };

  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
  for (const s of DEMO_STAFF) {
    let user = list?.users.find((u) => u.email === s.email);
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: s.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
      user = data.user;
    }
    await supabaseAdmin
      .from("staff")
      .upsert({ user_id: user.id, name: s.name, role: s.role }, { onConflict: "user_id" });
  }
  return { ok: true };
});
