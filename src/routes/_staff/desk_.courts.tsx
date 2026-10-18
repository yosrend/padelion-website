import { createFileRoute } from "@tanstack/react-router";
import { PageHead, SectionHead } from "@/components/staff/StaffUI";
import { NoSymbolIcon } from "@heroicons/react/24/outline";
import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Chip, Input } from "@/design-system/padelion";
import { supabase } from "@/integrations/supabase/client";
import { CLOSE_MIN, OPEN_MIN, dayLabel, hm, isoAt, jkt, todayJkt } from "@/lib/padel";
import { activeBooking, fetchBlocks, fetchBookingsList, fetchCourtsAll, logLine, rpc, useLive, useNow, type Row } from "@/lib/desk-data";

export const Route = createFileRoute("/_staff/desk_/courts")({
  head: () => ({
    meta: [
      { title: "Courts and blocks, Padelion front desk" },
      { name: "description", content: "Switch courts on and off and block times for maintenance or events." },
      { property: "og:title", content: "Courts and blocks, Padelion front desk" },
      { property: "og:description", content: "Switch courts on and off and block times for maintenance or events." },
    ],
  }),
  component: Courts,
});

const REASONS = ["Maintenance", "Event"];
const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

function Courts() {
  const qc = useQueryClient();
  const now = useNow();
  useLive("courts", ["courts", "court_blocks", "bookings"]);
  const courts = useQuery({ queryKey: ["desk", "courts"], queryFn: fetchCourtsAll });
  const blocks = useQuery({ queryKey: ["desk", "blocks"], queryFn: fetchBlocks });
  const bookings = useQuery({ queryKey: ["desk", "bookings"], queryFn: fetchBookingsList });
  const today = todayJkt();

  const [court, setCourt] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("14:00");
  const [to, setTo] = useState("16:00");
  const [reason, setReason] = useState("Maintenance");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const courtId = court ?? courts.data?.[0]?.id ?? null;
  const s = new Date(isoAt(date, toMins(from))).getTime();
  const e = new Date(isoAt(date, toMins(to))).getTime();
  const fromErr = !from
    ? "Add a start time."
    : toMins(from) < OPEN_MIN || toMins(from) >= CLOSE_MIN
      ? `Start between ${hm(OPEN_MIN)} and ${hm(CLOSE_MIN - 30)}.`
      : s < now
        ? "This time has already passed."
        : null;
  const toErr = !to
    ? "Add an end time."
    : e <= s
      ? "The end time must be after the start."
      : toMins(to) > CLOSE_MIN
        ? `The venue closes at ${hm(CLOSE_MIN)}.`
        : null;
  const dateErr = !date || date < today ? "Pick today or a later date." : null;
  const valid = !!courtId && !fromErr && !toErr && !dateErr;
  const hit = valid
    ? (bookings.data ?? []).filter((b) => b.court_id === courtId && activeBooking(b, now) && new Date(b.starts_at).getTime() < e && new Date(b.ends_at).getTime() > s)
    : [];

  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  async function toggle(c: Row) {
    const next = !(optimistic[c.id] ?? c.is_active);
    setOptimistic((o) => ({ ...o, [c.id]: next }));
    const { error } = await supabase.from("courts").update({ is_active: next }).eq("id", c.id);
    if (error) setOptimistic((o) => { const n = { ...o }; delete n[c.id]; return n; });
    else {
      c = { ...c, is_active: !next };
      await logLine("court", `${c.name} switched ${c.is_active ? "off" : "on"}`);
      qc.invalidateQueries({ queryKey: ["desk"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
    }
  }

  async function save() {
    if (!valid || !courtId) return;
    setBusy(true);
    setMsg(null);
    try {
      const n = (await rpc("create_block", { _court: courtId, _starts: isoAt(date, toMins(from)), _ends: isoAt(date, toMins(to)), _reason: reason })) as number;
      setMsg(n ? `Time blocked. ${n} ${n === 1 ? "player was" : "players were"} offered a move.` : "Time blocked.");
      qc.invalidateQueries({ queryKey: ["desk"] });
    } catch (err) {
      setMsg((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <main className="stack-8">
      <PageHead icon={Squares2X2Icon} eyebrow="Front desk" title="Courts and blocks" desc="Open or close a court, and block times for maintenance or events." />

      {courts.error ? (
        <Card surface="desk"><p className="pds-body" role="alert">Courts didn't load. Refresh to try again.</p></Card>
      ) : (
        <Card surface="desk" className="needs">
          {(courts.data ?? []).map((c) => {
            const todays = (blocks.data ?? []).filter((b) => b.court_id === c.id && jkt(b.starts_at).date === today);
            return (
              <div key={c.id} className="court-row">
                <div className="stack-1">
                  <p className="pds-meta">{c.kind}</p>
                  <p className="pds-label">{c.name}</p>
                </div>
                <div className="chip-row">
                  {todays.length === 0 ? <span className="pds-meta">No blocks today</span> : todays.map((b) => (
                    <Chip key={b.id} tone="hold">{b.reason || "Blocked"}, {hm(jkt(b.starts_at).mins)} to {hm(jkt(b.ends_at).mins)}</Chip>
                  ))}
                </div>
                <button type="button" role="switch" aria-checked={optimistic[c.id] ?? c.is_active} aria-label={`${c.name} open for booking`} className="rain-switch" onClick={() => toggle(c)}>
                  <span className="pds-meta">{(optimistic[c.id] ?? c.is_active) ? "Open" : "Off"}</span>
                  <span className="rain-switch__track" aria-hidden="true"><span className="rain-switch__knob" /></span>
                </button>
              </div>
            );
          })}
        </Card>
      )}

      <section className="stack-4" aria-labelledby="blk">
        <SectionHead id="blk" icon={NoSymbolIcon} title="Block a time" hint="For maintenance, coaching or an event" />
        <Card surface="desk" className="stack-6">
          <div className="stack-2">
            <p className="pds-field__label">Court</p>
            <div className="seg" role="radiogroup" aria-label="Court">
              {(courts.data ?? []).map((c) => (
                <Button key={c.id} surface="desk" variant={courtId === c.id ? "selection" : "secondary"} aria-pressed={courtId === c.id} onClick={() => setCourt(c.id)}>{c.name}</Button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <Input label="Date" type="date" min={today} value={date} onChange={(ev) => ev.target.value && setDate(ev.target.value)} error={dateErr} />
            <Input label="From" type="time" step={1800} min="06:00" max="22:30" value={from} onChange={(ev) => setFrom(ev.target.value)} error={fromErr} />
            <Input label="To" type="time" step={1800} min="06:30" max="23:00" value={to} onChange={(ev) => setTo(ev.target.value)} error={toErr} />
          </div>
          <div className="stack-2">
            <p className="pds-field__label">Reason</p>
            <div className="seg" role="radiogroup" aria-label="Reason">
              {REASONS.map((r) => (
                <Button key={r} surface="desk" variant={reason === r ? "selection" : "secondary"} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</Button>
              ))}
            </div>
          </div>
          {hit.length ? (
            <div className="stack-2 warn-box">
              <p className="pds-label">{hit.length} {hit.length === 1 ? "booking" : "bookings"} in this time. They will get an option to move.</p>
              <ul className="plain-list">
                {hit.map((b) => <li key={b.id} className="pds-meta pds-num">{b.code}, {b.guest_name}, {dayLabel(jkt(b.starts_at).date)} {hm(jkt(b.starts_at).mins)}</li>)}
              </ul>
            </div>
          ) : null}
          <div className="row-actions row-actions--start">
            <Button surface="desk" variant="primary" disabled={!valid || busy} onClick={save}>{busy ? "Saving" : "Block this time"}</Button>
            {msg ? <p className="pds-meta" role="status">{msg}</p> : null}
          </div>
        </Card>
      </section>
    </main>
  );
}
