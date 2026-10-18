import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHead, SectionHead } from "@/components/staff/StaffUI";
import { AdjustmentsHorizontalIcon, CurrencyDollarIcon, ShoppingBagIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { logLine } from "@/lib/desk-data";

import { rules } from "@/lib/validate";
export const Route = createFileRoute("/_staff/owner_/settings")({
  head: () => ({
    meta: [
      { title: "Prices and staff, Padelion owner" },
      { name: "description", content: "Set court prices, booking rules, add-ons and staff at Padelion." },
      { property: "og:title", content: "Prices and staff, Padelion owner" },
      { property: "og:description", content: "Set court prices, booking rules, add-ons and staff at Padelion." },
    ],
  }),
  component: Settings,
});

type Price = { id: string; court_id: string; name: string; off_peak_idr: number; peak_idr: number };
type Rules = { hold_minutes: number; deposit_pct: number; balance_hours: number; reschedule_hours: number; offer_minutes: number };
type Addon = { id: string; name: string; price_idr: number; is_active: boolean; sort: number; isNew?: boolean };
type Staff = { id: string; user_id: string | null; name: string; email: string | null; role: "front_desk" | "owner" };
type Form = { prices: Price[]; peakStart: number; peakEnd: number; weekend: boolean; rules: Rules; addons: Addon[]; staff: Staff[] };

async function load(): Promise<Form> {
  const [pr, c, s, a, st] = await Promise.all([
    supabase.from("price_rules").select("id,court_id,off_peak_idr,peak_idr,weekday_peak_start,weekday_peak_end,weekend_all_peak"),
    supabase.from("courts").select("id,name,sort").order("sort"),
    supabase.from("venue_settings").select("hold_minutes,deposit_pct,balance_hours,reschedule_hours,offer_minutes").eq("id", 1).single(),
    supabase.from("addons").select("id,name,price_idr,is_active,sort").order("sort"),
    supabase.from("staff").select("id,user_id,name,email,role").order("role", { ascending: false }).order("name"),
  ]);
  const err = pr.error || c.error || s.error || a.error || st.error;
  if (err) throw new Error(err.message);
  const courts = c.data ?? [];
  const rules = pr.data ?? [];
  const first = rules[0];
  return {
    prices: courts.flatMap((ct) => {
      const r = rules.find((x) => x.court_id === ct.id);
      return r ? [{ id: r.id, court_id: ct.id, name: ct.name, off_peak_idr: r.off_peak_idr, peak_idr: r.peak_idr }] : [];
    }),
    peakStart: first?.weekday_peak_start ?? 17,
    peakEnd: first?.weekday_peak_end ?? 23,
    weekend: first?.weekend_all_peak ?? true,
    rules: s.data as Rules,
    addons: (a.data ?? []) as Addon[],
    staff: (st.data ?? []) as Staff[],
  };
}

function Settings() {
  const { me } = Route.useRouteContext();
  if (me.role !== "owner") return <Navigate to="/desk" replace />;
  return <SettingsForm ownerName={me.name} />;
}

function num(v: string) {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function SettingsForm({ ownerName }: { ownerName: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["desk", "settings"], queryFn: load });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [invite, setInvite] = useState({ name: "", email: "", role: "front_desk" as Staff["role"] });
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteTried, setInviteTried] = useState(false);

  useEffect(() => { if (q.data) setForm(structuredClone(q.data)); }, [q.data]);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null)); }, []);

  if (q.error) return <Card surface="desk"><p className="pds-body" role="alert">Settings didn't load. Refresh to try again.</p></Card>;
  if (!form || !q.data) return <div className="skel skel--timeline" aria-busy="true" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(q.data);
  const set = (patch: Partial<Form>) => { setMsg(null); setForm({ ...form, ...patch }); };
  // Field level checks. Each returns the message shown under that field, or null.
  const offErr = (p: Price) => (p.off_peak_idr < 10000 ? "At least Rp 10.000." : p.off_peak_idr > 10000000 ? "At most Rp 10.000.000." : null);
  const peakErr = (p: Price) =>
    p.peak_idr < 10000 ? "At least Rp 10.000." : p.peak_idr > 10000000 ? "At most Rp 10.000.000." : p.peak_idr < p.off_peak_idr ? "Peak can't be lower than off-peak." : null;
  const peakStartErr = form.peakStart < 6 || form.peakStart > 22 ? "Use an hour from 6 to 22." : null;
  const peakEndErr =
    form.peakEnd < 7 || form.peakEnd > 23 ? "Use an hour from 7 to 23." : form.peakEnd <= form.peakStart ? "Peak must end after it starts." : null;
  const RULE_LIMITS: Record<keyof Rules, [number, number]> = {
    hold_minutes: [5, 60],
    deposit_pct: [10, 100],
    balance_hours: [0, 48],
    reschedule_hours: [0, 72],
    offer_minutes: [5, 60],
  };
  const ruleErr = (k: keyof Rules) => {
    const [lo, hi] = RULE_LIMITS[k];
    const v = form.rules[k];
    return v < lo || v > hi ? `Use a number from ${lo} to ${hi}.` : null;
  };
  const addonNameErr = (a: Addon) => (!a.name.trim() ? "Add a name." : a.name.trim().length < 2 ? "The name needs at least 2 letters." : null);
  const addonPriceErr = (a: Addon) => (a.price_idr > 5000000 ? "At most Rp 5.000.000." : null);
  const invalid =
    !!peakStartErr ||
    !!peakEndErr ||
    form.prices.some((p) => offErr(p) || peakErr(p)) ||
    (Object.keys(RULE_LIMITS) as (keyof Rules)[]).some((k) => ruleErr(k)) ||
    form.addons.some((a) => addonNameErr(a) || addonPriceErr(a));

  async function save() {
    if (!form || !q.data) return;
    setBusy(true);
    setMsg(null);
    try {
      const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
        const { error } = await p;
        if (error) throw new Error(error.message);
      };
      for (const p of form.prices) {
        await run(supabase.from("price_rules").update({
          off_peak_idr: p.off_peak_idr, peak_idr: p.peak_idr,
          weekday_peak_start: form.peakStart, weekday_peak_end: form.peakEnd, weekend_all_peak: form.weekend,
        }).eq("id", p.id));
      }
      await run(supabase.from("venue_settings").update({ ...form.rules, updated_at: new Date().toISOString() }).eq("id", 1));
      for (const a of form.addons) {
        const row = { name: a.name.trim().slice(0, 60), price_idr: a.price_idr, is_active: a.is_active, sort: a.sort };
        await run(a.isNew ? supabase.from("addons").insert(row) : supabase.from("addons").update(row).eq("id", a.id));
      }
      for (const s of form.staff) {
        const old = q.data.staff.find((x) => x.id === s.id);
        if (old && old.role !== s.role) await run(supabase.from("staff").update({ role: s.role }).eq("id", s.id));
      }
      await logLine("settings", `Prices updated by ${ownerName}`);
      await qc.invalidateQueries({ queryKey: ["desk", "settings"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      setMsg("Saved. New prices show on the booking page now.");
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  async function remove(s: Staff) {
    const { error } = await supabase.from("staff").delete().eq("id", s.id);
    if (error) return setInviteMsg(error.message);
    await logLine("staff", `${s.name} removed from staff by ${ownerName}`);
    qc.invalidateQueries({ queryKey: ["desk", "settings"] });
  }

  async function sendInvite() {
    const email = invite.email.trim().toLowerCase();
    const name = invite.name.trim() || email.split("@")[0];
    setInviteTried(true);
    if (rules.email(email) || (invite.name.trim() && rules.staffName(invite.name))) return;
    if (form?.staff.some((s) => s.email?.toLowerCase() === email)) return setInviteMsg("That email is already on the team.");
    const { error } = await supabase.from("staff").insert({ name: name.slice(0, 60), email, role: invite.role });
    if (error) return setInviteMsg(error.message);
    await logLine("staff", `${name} invited as ${invite.role === "owner" ? "owner" : "front desk"} by ${ownerName}`);
    setInvite({ name: "", email: "", role: "front_desk" });
    setInviteTried(false);
    setInviteMsg("Invite saved. Email sending is off in the demo.");
    qc.invalidateQueries({ queryKey: ["desk", "settings"] });
  }

  const RULES: { key: keyof Rules; label: string; unit: string }[] = [
    { key: "hold_minutes", label: "Hold", unit: "minutes" },
    { key: "deposit_pct", label: "Deposit", unit: "%" },
    { key: "balance_hours", label: "Balance due", unit: "hours before play" },
    { key: "reschedule_hours", label: "Free reschedule", unit: "hours before play" },
    { key: "offer_minutes", label: "Waitlist offer", unit: "minutes" },
  ];

  return (
    <main className="stack-8 settings">
      <PageHead icon={Cog6ToothIcon} eyebrow="Owner" title="Prices and staff" desc="Prices, booking rules, add-ons, and who can sign in to the desk." />

      <section className="stack-4" aria-labelledby="prices">
        <SectionHead id="prices" icon={CurrencyDollarIcon} title="Prices per hour" hint="Off-peak and peak, per court" />
        <Card surface="desk" className="stack-6">
          <div className="price-grid">
            {form.prices.map((p, i) => (
              <div key={p.id} className="stack-3">
                <p className="pds-label">{p.name}</p>
                <Input label="Off-peak, Rp" inputMode="numeric" className="pds-num" value={p.off_peak_idr.toLocaleString("id-ID")} error={offErr(p)}
                  onChange={(e) => set({ prices: form.prices.map((x, j) => (j === i ? { ...x, off_peak_idr: num(e.target.value) } : x)) })} />
                <Input label="Peak, Rp" inputMode="numeric" className="pds-num" value={p.peak_idr.toLocaleString("id-ID")} error={peakErr(p)}
                  onChange={(e) => set({ prices: form.prices.map((x, j) => (j === i ? { ...x, peak_idr: num(e.target.value) } : x)) })} />
              </div>
            ))}
          </div>
          <div className="form-grid">
            <Input label="Weekday peak from (hour)" type="number" min={6} max={22} value={form.peakStart} error={peakStartErr} onChange={(e) => set({ peakStart: num(e.target.value) })} />
            <Input label="Weekday peak to (hour)" type="number" min={7} max={23} value={form.peakEnd} error={peakEndErr} onChange={(e) => set({ peakEnd: num(e.target.value) })} />
            <div className="switch-cell">
              <Switch on={form.weekend} label="Weekends are peak all day" onToggle={() => set({ weekend: !form.weekend })} />
            </div>
          </div>
        </Card>
      </section>

      <section className="stack-4" aria-labelledby="rules">
        <SectionHead id="rules" icon={AdjustmentsHorizontalIcon} title="Booking rules" hint="Holds, deposits and reschedules" />
        <Card surface="desk">
          <div className="rules-grid">
            {RULES.map((r) => (
              <Input key={r.key} label={`${r.label}, ${r.unit}`} type="number" min={RULE_LIMITS[r.key][0]} max={RULE_LIMITS[r.key][1]} value={form.rules[r.key]} error={ruleErr(r.key)}
                onChange={(e) => set({ rules: { ...form.rules, [r.key]: num(e.target.value) } })} />
            ))}
          </div>
        </Card>
      </section>

      <section className="stack-4" aria-labelledby="addons">
        <SectionHead id="addons" icon={ShoppingBagIcon} title="Add-ons" hint="Rackets, balls and towels at the desk" />
        <Card surface="desk" className="needs">
          {form.addons.map((a, i) => (
            <div key={a.id} className="addon-row">
              <Input label="Name" value={a.name} maxLength={60} error={addonNameErr(a)} onChange={(e) => set({ addons: form.addons.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Input label="Price, Rp" inputMode="numeric" className="pds-num" value={a.price_idr.toLocaleString("id-ID")} error={addonPriceErr(a)}
                onChange={(e) => set({ addons: form.addons.map((x, j) => (j === i ? { ...x, price_idr: num(e.target.value) } : x)) })} />
              <Switch on={a.is_active} label={a.is_active ? "On sale" : "Off"} onToggle={() => set({ addons: form.addons.map((x, j) => (j === i ? { ...x, is_active: !x.is_active } : x)) })} />
            </div>
          ))}
          <div className="addon-row addon-row--add">
            <Button surface="desk" variant="secondary" icon={PlusIcon}
              onClick={() => set({ addons: [...form.addons, { id: crypto.randomUUID(), name: "", price_idr: 0, is_active: true, sort: form.addons.length + 1, isNew: true }] })}>
              Add row
            </Button>
          </div>
        </Card>
      </section>

      <section className="stack-4" aria-labelledby="staff">
        <SectionHead id="staff" icon={UserGroupIcon} title="Staff" hint="Who can sign in to the desk" />
        <Card surface="desk" className="needs">
          {form.staff.map((s, i) => (
            <div key={s.id} className="staff-row">
              <div className="stack-1">
                <p className="pds-label">{s.name}</p>
                <p className="pds-meta">{s.email ?? "No email on file"}{s.user_id ? "" : ", invited"}</p>
              </div>
              <label className="stack-1">
                <span className="pds-field__label">Role</span>
                <select className="pds-input" value={s.role} disabled={s.user_id === myId}
                  onChange={(e) => set({ staff: form.staff.map((x, j) => (j === i ? { ...x, role: e.target.value as Staff["role"] } : x)) })}>
                  <option value="front_desk">Front desk</option>
                  <option value="owner">Owner</option>
                </select>
              </label>
              {s.user_id === myId ? <span className="pds-meta">You</span> : (
                <button type="button" className="text-btn pds-label" onClick={() => remove(s)}>Remove</button>
              )}
            </div>
          ))}
          <div className="staff-row staff-row--invite">
            <Input label="Name" value={invite.name} maxLength={60} error={inviteTried && invite.name.trim() ? rules.staffName(invite.name) : null} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            <Input label="Invite by email" type="email" error={inviteTried ? rules.email(invite.email) : null} value={invite.email} maxLength={255} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@padelion.demo" />
            <label className="stack-1">
              <span className="pds-field__label">Role</span>
              <select className="pds-input" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as Staff["role"] })}>
                <option value="front_desk">Front desk</option>
                <option value="owner">Owner</option>
              </select>
            </label>
            <Button surface="desk" variant="secondary" onClick={sendInvite}>Invite</Button>
          </div>
          {inviteMsg ? <p className="pds-meta staff-row" role="status">{inviteMsg}</p> : null}
        </Card>
      </section>

      {msg && !dirty ? <p className="pds-meta" role="status">{msg}</p> : null}
      {dirty ? (
        <div className="save-bar">
          <p className="pds-meta">{invalid ? "Fix the highlighted values before saving." : msg ?? "You have unsaved changes."}</p>
          <div className="row-actions">
            <Button surface="desk" variant="secondary" onClick={() => setForm(structuredClone(q.data!))}>Undo</Button>
            <Button surface="desk" variant="primary" disabled={busy || invalid} onClick={save}>{busy ? "Saving" : "Save changes"}</Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="rain-switch" onClick={onToggle}>
      <span className="pds-label">{label}</span>
      <span className="rain-switch__track" aria-hidden="true"><span className="rain-switch__knob" /></span>
    </button>
  );
}
